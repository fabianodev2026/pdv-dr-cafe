use std::{
    fs,
    process::Command,
    thread,
    time::Duration,
};

#[tauri::command]
fn open_cash_drawer(payment_method: String, brand: String, serial_number: String) -> Result<String, String> {
    println!(
        "Dr. Cafe cash drawer requested: brand={brand}, serial={serial_number}, payment={payment_method}"
    );

    Ok("Comando nativo recebido. Driver ESC/POS sera ligado nesta ponte.".to_string())
}

#[tauri::command]
fn print_receipt(receipt_text: String) -> Result<String, String> {
    println!("Dr. Cafe receipt requested:\n{receipt_text}");

    Ok("Recibo recebido pelo modulo nativo de impressao.".to_string())
}

fn powershell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn sanitize_version(value: &str) -> String {
    value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || *character == '.' || *character == '-')
        .collect()
}

#[tauri::command]
fn start_system_update(
    app_handle: tauri::AppHandle,
    installer_url: String,
    version: String,
) -> Result<String, String> {
    let safe_version = sanitize_version(&version);
    let temp_dir = std::env::temp_dir();
    let installer_path = temp_dir.join(format!("PDV-Dr-Cafe-atualizacao-{safe_version}.exe"));
    let script_path = temp_dir.join(format!("PDV-Dr-Cafe-atualizacao-{safe_version}.ps1"));
    let app_path = std::env::current_exe()
        .map_err(|error| format!("Nao foi possivel localizar o executavel atual: {error}"))?;
    let app_pid = std::process::id();

    let script = format!(
        r#"$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$InstallerUrl = {installer_url}
$InstallerPath = {installer_path}
$AppPath = {app_path}
$AppPid = {app_pid}
try {{
  Start-Sleep -Milliseconds 800
  try {{
    Wait-Process -Id $AppPid -ErrorAction SilentlyContinue
  }} catch {{}}
  Invoke-WebRequest -UseBasicParsing -Uri $InstallerUrl -OutFile $InstallerPath
  Start-Process -FilePath $InstallerPath -ArgumentList '/S /UPDATE' -Wait
  Start-Sleep -Seconds 2
  Start-Process -FilePath $AppPath
}} catch {{
  try {{
    Start-Process -FilePath $AppPath
  }} catch {{}}
}}
"#,
        installer_url = powershell_quote(&installer_url),
        installer_path = powershell_quote(&installer_path.to_string_lossy()),
        app_path = powershell_quote(&app_path.to_string_lossy()),
        app_pid = app_pid,
    );

    fs::write(&script_path, script)
        .map_err(|error| format!("Nao foi possivel preparar o atualizador: {error}"))?;

    let script_path_text = script_path.to_string_lossy().to_string();

    Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-WindowStyle",
            "Hidden",
            "-File",
            script_path_text.as_str(),
        ])
        .spawn()
        .map_err(|error| format!("Nao foi possivel iniciar o atualizador: {error}"))?;

    thread::spawn(move || {
        thread::sleep(Duration::from_millis(1800));
        app_handle.exit(0);
    });

    Ok("Atualizacao iniciada. O PDV vai fechar e abrir sozinho.".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            open_cash_drawer,
            print_receipt,
            start_system_update,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o PDV Dr. Cafe desktop");
}
