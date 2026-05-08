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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![open_cash_drawer, print_receipt])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o PDV Dr. Cafe desktop");
}
