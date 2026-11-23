/* Datos de ejemplo para la vista previa (js/config.js -> DEMO_MODE).
   Todo es ficticio: ninguna boutique, cliente, dirección ni teléfono es real.
   Borra este archivo cuando quites el modo de vista previa. */
export const DEMO_PEDIDOS = {
  demo1: {
    numero: "A1001", estado: 2, creadoEn: 1,
    boutique: { nombre: "Boutique Ejemplo", calle: "Av. Ejemplo 123, Centro" },
    cliente: { nombre: "Cliente de prueba", direccion: "Calle Ficticia 45, Col. Ejemplo", telefono: "2411234567" }
  },
  demo2: {
    numero: "A1002", estado: 2, creadoEn: 2,
    boutique: { nombre: "Tienda Modelo", calle: "Calz. Demo 88" },
    cliente: { nombre: "Otro cliente de prueba", direccion: "Priv. Muestra 9", telefono: "2419876543" }
  },
  demo3: {
    numero: "A0999", estado: 3, creadoEn: 0, repartidorUid: "demo-uid",
    boutique: { nombre: "Boutique Ejemplo", calle: "Av. Ejemplo 123, Centro" },
    cliente: { nombre: "Cliente anterior", direccion: "Blvd. Simulado 5", telefono: "2415550000" }
  }
};
