<#
prints a slim project tree for Windows PowerShell

Usage:
  # show git-tracked files (recommended)
  .\scripts\tools\print-tree.ps1 -Mode git

  # show filesystem files excluding common generated directories
  .\scripts\tools\print-tree.ps1 -Mode fs

  # produce a compact top-level + one-level tree for quick overview
  .\scripts\tools\print-tree.ps1 -Mode compact -Depth 2

Options:
  -Mode: git | fs | compact
  -Depth: integer, used for 'compact' mode (how many path segments to show)
  -Roots: array of top-level folders to include for compact listing (default: src,data,scripts,public)
  -Exclude: array of paths (substrings) to exclude when using fs mode (default: node_modules,dist,.git)

Notes:
  - 'git' mode uses `git ls-files` to show tracked files only (fast & concise).
  - If no .git folder exists, 'git' mode will warn and fall back to 'fs'.

#>

param(
    [ValidateSet('git','fs','compact')]
    [string]$Mode = 'git',
    [int]$Depth = 2,
    [string[]]$Roots = @('src','data','scripts','public'),
    [string[]]$Exclude = @('node_modules','dist','.git'),
    [string]$OutFile = ''
)

function Write-OutputOrFile {
    param($lines)
    if ($OutFile -ne '') {
        $lines | Out-File -FilePath $OutFile -Encoding UTF8
    } else {
        $lines | ForEach-Object { Write-Output $_ }
    }
}

Push-Location -ErrorAction Stop (Get-Location)
try {
    switch ($Mode) {
        'git' {
            if (-not (Test-Path '.git')) {
                Write-Warning "No .git directory found; falling back to filesystem listing (fs mode)."
                $Mode = 'fs'
                break
            }
            $files = & git ls-files 2>$null | Sort-Object
            if (-not $files) { Write-Warning 'git ls-files returned no files.' }
            Write-OutputOrFile $files
        }

        'fs' {
            $cwd = (Get-Location).ProviderPath
            $items = Get-ChildItem -Recurse -File -ErrorAction SilentlyContinue |
                Where-Object {
                    $full = $_.FullName.ToLower()
                    foreach ($e in $Exclude) {
                        if ($full -like "*\$e\*") { return $false }
                    }
                    return $true
                } |
                ForEach-Object { $_.FullName.Substring($cwd.Length + 1).Replace('\','/') }
            $items = $items | Sort-Object
            Write-OutputOrFile $items
        }

        'compact' {
            # prefer git-tracked files for compact grouping if available
            $useGit = Test-Path '.git'
            if ($useGit) {
                $files = & git ls-files 2>$null | Sort-Object
            } else {
                $cwd = (Get-Location).ProviderPath
                $files = Get-ChildItem -Recurse -File -ErrorAction SilentlyContinue |
                    ForEach-Object { $_.FullName.Substring($cwd.Length + 1).Replace('\','/') } | Sort-Object
            }
            $compact = $files | ForEach-Object {
                $parts = $_ -split '/'
                if ($parts.Length -le $Depth) { $_ } else { ($parts[0..($Depth-1)] -join '/') }
            } | Sort-Object -Unique
            # Filter to the roots user likely cares about (optional)
            if ($Roots -and $Roots.Count -gt 0) {
                $compact = $compact | Where-Object {
                    $p = $_ -split '/' ; ($Roots -contains $p[0]) -or ($Roots -contains $_)
                }
            }
            Write-OutputOrFile $compact
        }
    }
}
finally { Pop-Location }
