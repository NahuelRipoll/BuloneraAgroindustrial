# PDF de precios a Excel

**Goal:** Convertir el PDF del ERP en una planilla con Código, Lista 1, Lista 2, Lista 3 y Stock actual, lista para importar.

**Architecture:** Compartir la extracción por coordenadas con el lector actual. Generar XLSX con códigos de texto y valores numéricos, más CSV con las mismas cinco columnas. Las celdas no confiables quedan vacías y se detallan en una segunda hoja de revisión. La importación permite elegir la lista y no aplica stock.

**Tech Stack:** PDF.js, Node.js, TypeScript y ZIP/OpenXML con fflate.

- [x] Extender el parser para extraer tres precios y stock, con ceros, negativos de stock y celdas ambiguas.
- [x] Crear `tools/pdf-a-excel.mjs` con parámetros de entrada/salida, protección contra sobrescritura y resumen de revisión.
- [x] Crear escritor XLSX reutilizable y probar tipos de celda, XML y CSV.
- [x] Permitir elegir Lista 1/2/3 al importar Excel y CSV, manteniendo archivos de precio único.
- [x] Convertir el PDF real, abrir el Excel con un lector independiente y comprobar códigos, precios, stock y cantidad de filas.
- [x] Ejecutar pruebas, TypeScript, build y comprobación de navegador de la selección de listas.

Resultado: 581 páginas, 20.317 códigos y 20.317 stocks leídos; 2.447 filas con observaciones de precios. XLSX validado con openpyxl y read-excel-file. El navegador comprobó Lista 2 desde XLSX y Lista 3 desde CSV, conservando el stock del catálogo.
