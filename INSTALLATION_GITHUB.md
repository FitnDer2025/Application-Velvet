# Installation GitHub

## Méthode simple
1. Décompresser le ZIP.
2. Ouvrir le dépôt GitHub.
3. **Add file** → **Upload files**.
4. Glisser tout le contenu du dossier.
5. Valider avec : `docs: initialize Zwit OS starter kit`.

## PowerShell
```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\push-to-github.ps1 -RepositoryUrl "URL_DU_DEPOT"
```

Si le dépôt contient déjà du code, utiliser une branche documentaire :
```powershell
.\scripts\push-to-github.ps1 -RepositoryUrl "URL_DU_DEPOT" -Branch "docs/velvet-os"
```
