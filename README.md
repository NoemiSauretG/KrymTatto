# Krym Tattoo - Vercel

## 1. Instalar
npm install

## 2. Probar localmente
npm run dev

## 3. Variables de entorno
Copia .env.example a .env.local y completa:
- DB_HOST
- DB_PORT
- DB_USER
- DB_PASSWORD
- DB_NAME
- DB_SSL
- ADMIN_PASSWORD
- ADMIN_JWT_SECRET
- SMTP_USER
- SMTP_PASSWORD
- SMTP_FROM
- CONTACT_TO

Vercel Blob se conecta desde el proyecto de Vercel. Crea un Blob Store en Vercel Storage y asígnalo al proyecto.

## 4. Desplegar
npm i -g vercel
vercel login
vercel
vercel --prod

## 5. URLs
/
→ web pública

/admin.html
→ panel de administración

Las operaciones de crear, borrar y reordenar requieren JWT de administrador.
