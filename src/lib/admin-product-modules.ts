export const productModules = [
  { id: "catalogo", title: "Catálogo", description: "Buscá, editá, publicá o eliminá artículos. Seleccioná varios para trabajar en lote.", action: "Administrar catálogo" },
  { id: "carga", title: "Carga rápida", description: "Completá varios artículos en una grilla, duplicá filas o pegá datos de Excel.", action: "Cargar artículos" },
  { id: "importar", title: "Importar archivo", description: "Cargá el listado del ERP o la plantilla Excel. Revisá rubros y guardá el lote.", action: "Importar artículos" },
  { id: "precios", title: "Precios", description: "Leé el PDF del proveedor, pegá una lista o aplicá un porcentaje. Revisá antes de guardar.", action: "Actualizar precios" },
  { id: "ofertas", title: "Ofertas", description: "Elegí los artículos destacados y sus precios promocionales para la portada.", action: "Administrar ofertas" },
] as const;
