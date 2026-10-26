# Red de Historiales Clinicos - preparacion de paquete de revision de codigo
# No accede a MongoDB ni modifica los archivos del proyecto.
# Ejecutar desde cualquier carpeta: .\scripts\preparar_auditoria_pediatria.ps1
$ErrorActionPreference = 'Stop'

# Raiz del repositorio: la carpeta que contiene scripts\ (este archivo esta en scripts\).
$raiz = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not (Test-Path -LiteralPath (Join-Path $raiz 'instituciones\pediatria\backend\server.js'))) {
    throw 'No se encontro instituciones\pediatria\backend\server.js: el script debe estar en scripts\ del proyecto.'
}

$temporal = Join-Path $env:TEMP ('auditoria_pediatria_' + [guid]::NewGuid().ToString('N'))
$salida = Join-Path $raiz 'codigo_para_auditoria_pediatria.zip'
New-Item -ItemType Directory -Force -Path $temporal | Out-Null

function CopiarArchivo([string]$relativo) {
    $origen = Join-Path $raiz $relativo
    if (-not (Test-Path -LiteralPath $origen -PathType Leaf)) { return }
    $destino = Join-Path $temporal $relativo
    $carpeta = Split-Path -Parent $destino
    New-Item -ItemType Directory -Force -Path $carpeta | Out-Null
    Copy-Item -LiteralPath $origen -Destination $destino
}

# Solamente manifiestos y documentacion de codigo (no credenciales ni datos).
@('package.json','package-lock.json','README.md','.gitignore','.env.example',
  'apps\web\package.json','apps\web\package-lock.json',
  'apps\web\index.html','apps\web\vite.config.js','apps\web\alias.js') | ForEach-Object { CopiarArchivo $_ }

# Solo codigo fuente de rutas conocidas. NO copiar JSON de prueba, capturas, dependencias ni datos.
$extPermitidas = @('.js','.jsx','.ts','.tsx','.css','.html','.mjs','.cjs','.ps1')
foreach ($carpeta in @('apps\web\src','instituciones','tests','scripts')) {
    $dir = Join-Path $raiz $carpeta
    if (-not (Test-Path -LiteralPath $dir -PathType Container)) { continue }
    Get-ChildItem -LiteralPath $dir -File -Recurse | Where-Object { $_.FullName -notmatch '\\(node_modules|dist|capturas[^\\]*)\\' } | ForEach-Object {
        if ($extPermitidas -contains $_.Extension.ToLowerInvariant()) {
            $relativo = $_.FullName.Substring($raiz.Length + 1)
            CopiarArchivo $relativo
        }
    }
}

# Documentacion tecnica en Markdown (general y de cada institucion); excluir PDF, imagenes y capturas.
foreach ($carpeta in @('docs','instituciones')) {
    $dir = Join-Path $raiz $carpeta
    if (-not (Test-Path -LiteralPath $dir -PathType Container)) { continue }
    Get-ChildItem -LiteralPath $dir -File -Recurse -Filter '*.md' | ForEach-Object {
        $relativo = $_.FullName.Substring($raiz.Length + 1)
        CopiarArchivo $relativo
    }
}

try {
    if (Test-Path -LiteralPath $salida) { Remove-Item -LiteralPath $salida -Force }
    Compress-Archive -Path (Join-Path $temporal '*') -DestinationPath $salida -CompressionLevel Optimal
    Write-Host ''
    Write-Host 'PAQUETE CREADO:' -ForegroundColor Green
    Write-Host $salida
    Write-Host ''
    Write-Host 'No incluye .env, node_modules, respaldos, capturas ni exportaciones de la base.'
    Write-Host 'Antes de compartirlo, revisa que ningun archivo de codigo o Markdown contenga claves o datos reales.'
} finally {
    if (Test-Path -LiteralPath $temporal) { Remove-Item -LiteralPath $temporal -Recurse -Force }
}
