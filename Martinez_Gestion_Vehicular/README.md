# MARTÍNEZ – Gestión Integral de Mantenimiento Vehicular

Sistema web de control de flota con registros de ejemplo editables, seguimiento por kilometraje y reporte Excel.

## Funcionalidades
- Vehículos, historial de aceite, mantenimientos, chequeo semanal, documentos/SOAT y observaciones.
- Edición y eliminación de registros por módulo.
- Control de aceite por ciclos sucesivos: el siguiente cambio se calcula como **kilometraje del último cambio + intervalo configurado** (5,000 km por defecto).
- El kilometraje actual se actualiza al registrar la revisión semanal; el semáforo se recalcula para ese vehículo.
- Semáforo: verde (>1,500 km restantes), amarillo (501–1,500), naranja (101–500), rojo (100 o menos / vencido).
- Excel con hojas `Control de aceite`, `Resumen y semáforo` y `Revisión semanal`.
- Sincronización de pantalla cada 15 segundos entre usuarios cuando todos usan el mismo backend PostgreSQL.

## Ejemplo de ciclo de aceite
Último cambio a 10,000 km + intervalo de 5,000 = siguiente cambio a 15,000 km. Si el kilometraje semanal se actualiza a 11,500, quedan 3,500 km (verde). Al registrar un cambio a 15,000 km, el siguiente pasa automáticamente a 20,000 km. Cada vehículo tiene su propio ciclo.

## Ejecutar localmente
Requiere Node.js 20 o superior.
```bash
npm install
npm start
```
Abrir `http://localhost:3000`. Si el puerto está ocupado en PowerShell:
```powershell
$env:PORT=3001
npm start
```
Sin `DATABASE_URL`, se usa `data/database.json` local. Ese modo es solo para pruebas en una computadora; no sincroniza varios equipos.

## Publicación recomendada: GitHub + Render + PostgreSQL
1. Sube el contenido completo del proyecto a un repositorio GitHub.
2. En Render crea una base de datos PostgreSQL.
3. Crea un Web Service desde ese repositorio, con `npm install` y `npm start`.
4. Configura `DATABASE_URL` con la URL interna de PostgreSQL y `PGSSLMODE=require` si Render lo requiere.
5. Despliega. El backend Render también sirve el frontend completo; esta es la opción más sencilla y evita separar el frontend.
6. Para que varias personas compartan registros, todas deben entrar a la misma URL pública de Render. La pantalla consulta cambios cada 15 segundos.

## Publicar frontend aparte en Vercel (opcional)
La opción recomendada es usar la URL Render para toda la aplicación. Si de todas formas quieres Vercel:
1. Importa el mismo repositorio en Vercel.
2. Configura el proyecto para servir la carpeta `public` como frontend estático.
3. Después de publicar el backend en Render, abre `public/config.js` y coloca `window.API_BASE_URL = 'https://TU-SERVICIO.onrender.com';` (sin `/` al final). Vuelve a subir el cambio a GitHub para que Vercel lo redepliegue.
4. En Render configura `FRONTEND_URL` con el dominio de Vercel, o deja `*` si no vas a restringir el origen.

## Exportar Excel
En el módulo `Cambios de aceite`, pulsa `Descargar Excel`. El archivo contiene el cuadro por vehículo, el resumen del semáforo y el historial de revisiones semanales.

## Importante sobre acceso y seguridad
Esta entrega incluye almacenamiento compartido PostgreSQL, pero todavía no incorpora inicio de sesión ni roles de usuario. No publiques datos personales o información sensible ni uses el enlace abierto como sistema empresarial definitivo hasta añadir autenticación, permisos y auditoría. El modo JSON local no sirve como base multiusuario en la nube.
