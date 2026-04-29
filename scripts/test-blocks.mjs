import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import ts from 'typescript'

const root = process.cwd()
let failures = 0

const block = (name, run) => {
  process.stdout.write(`\n[${name}]\n`)

  try {
    run()
    console.log('OK')
  } catch (error) {
    failures += 1
    console.error(`ERRO: ${error.message}`)
  }
}

const readText = (path) => readFileSync(join(root, path), 'utf8')

const requireFile = (path) => {
  if (!existsSync(join(root, path))) {
    throw new Error(`Arquivo nao encontrado: ${path}`)
  }
}

const requireIncludes = (text, expected, label) => {
  if (!text.includes(expected)) {
    throw new Error(`Nao encontrei ${label}: ${expected}`)
  }
}

block('Arquivos principais', () => {
  [
    'src/components/LoginScreen.css',
    'src/components/LoginScreen.tsx',
    'src/components/TableManager.tsx',
    'src/components/OrdersManager.tsx',
    'src/components/CustomerMenu.tsx',
    'src/lib/supabaseClient.ts',
    'src/vite-env.d.ts',
    'public/logo.jpeg',
  ].forEach(requireFile)
})

block('Variaveis do Supabase', () => {
  const supabaseClient = readText('src/lib/supabaseClient.ts')
  requireIncludes(supabaseClient, 'VITE_SUPABASE_URL', 'VITE_SUPABASE_URL')
  requireIncludes(supabaseClient, 'VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY')
  requireIncludes(readText('src/vite-env.d.ts'), 'vite/client', 'types do Vite')

  if (existsSync(join(root, '.env'))) {
    const env = readText('.env')
    requireIncludes(env, 'VITE_SUPABASE_URL=', '.env VITE_SUPABASE_URL')
    requireIncludes(env, 'VITE_SUPABASE_ANON_KEY=', '.env VITE_SUPABASE_ANON_KEY')
  } else {
    console.log('Aviso: .env local nao encontrado. Em producao use as variaveis da Vercel.')
  }
})

const loginCss = readText('src/components/LoginScreen.css')

block('CSS do login', () => {
  const commonMistakes = [
    ['linear -gradient', 'Use linear-gradient sem espaco.'],
    ['backgroud-', 'Use background, nao backgroud.'],
    ['border-radius: px', 'Coloque um numero antes de px, exemplo 10px.'],
    ['url(`', 'Use aspas simples ou duplas no url, exemplo url("/fundo.jpg").'],
  ]

  for (const [mistake, help] of commonMistakes) {
    if (loginCss.includes(mistake)) {
      throw new Error(help)
    }
  }
})

block('Imagens usadas no CSS', () => {
  const urlMatches = [...loginCss.matchAll(/url\(['"]?\/([^'")]+)['"]?\)/g)]

  for (const match of urlMatches) {
    const imageName = match[1]
    if (!existsSync(join(root, 'public', imageName))) {
      throw new Error(`Imagem chamada no CSS nao existe em public: ${imageName}`)
    }
  }
})

block('Rotas principais', () => {
  const router = readText('src/router/index.tsx')
  ;[
    '/cardapio',
    '/mesas',
    '/pedidos',
    '/produtos',
    '/pendencias',
    '/configuracoes',
  ].forEach((route) => requireIncludes(router, route, `rota ${route}`))
})

block('Pedidos', () => {
  const orders = readText('src/components/OrdersManager.tsx')
  requireIncludes(orders, "'entregue'", 'status entregue')
  requireIncludes(orders, 'btn-delivered', 'botao Entregue')
  requireIncludes(orders, 'room_orders', 'pedidos dos quartos')
})

block('Cardapio do cliente', () => {
  const customerMenu = readText('src/components/CustomerMenu.tsx')
  requireIncludes(customerMenu, 'room_orders', 'envio para room_orders')
  requireIncludes(customerMenu, 'patientName', 'nome do paciente')
  requireIncludes(customerMenu, 'phone', 'telefone')
})

block('TypeScript', () => {
  const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json')

  if (!configPath) {
    throw new Error('tsconfig.json nao encontrado.')
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)

  if (configFile.error) {
    throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'))
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    root,
    { noEmit: true },
    configPath,
  )

  const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options)
  const diagnostics = ts.getPreEmitDiagnostics(program)

  if (diagnostics.length > 0) {
    const message = diagnostics
      .slice(0, 5)
      .map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      )
      .join('\n')

    throw new Error(message)
  }
})

block('Public limpo', () => {
  const files = readdirSync(join(root, 'public'))
  const allowed = new Set(['.ico', '.jpg', '.jpeg', '.png', '.webp', '.svg'])
  const invalid = files.filter((file) => !allowed.has(extname(file).toLowerCase()))

  if (invalid.length > 0) {
    throw new Error(`Arquivos inesperados em public: ${invalid.join(', ')}`)
  }
})

if (failures > 0) {
  console.error(`\nResultado: ${failures} bloco(s) com erro.`)
  process.exit(1)
}

console.log('\nResultado: todos os blocos passaram.')
