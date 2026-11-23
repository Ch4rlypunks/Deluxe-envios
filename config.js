/* ---------- CONFIGURACIÓN (ajusta a tu proyecto) ----------
   La apiKey web NO es secreta: la seguridad real está en las reglas de la RTDB.
   Modelo asumido:
   /pedidos/{id}: { numero, estado(1..4), creadoEn, boutique:{nombre,calle},
                    cliente:{nombre,direccion,telefono}, seguimiento?, repartidorUid?, actualizadoEn? }
   /repartidores/{uid}: true                                                          */
export const firebaseConfig = {
  apiKey: "AIzaSyD_cXNv3kvDXUTSYh8NQ4Q14VbCk00F88s",
  authDomain: "tienda-ropa-37ece.firebaseapp.com",
  databaseURL: "https://tienda-ropa-37ece-default-rtdb.firebaseio.com",
  projectId: "tienda-ropa-37ece",
  storageBucket: "tienda-ropa-37ece.firebasestorage.app",
  messagingSenderId: "632778449329",
  appId: "1:632778449329:web:e20be98a1745213f699d90"
};
export const CIUDAD = "Apizaco, Tlaxcala";
export const HOSTS_PERMITIDOS = []; // vacío = cualquier https; ej. ["uber.com","didi-food.com"]

/* ⚠️ VISTA PREVIA — solo para ver la interfaz antes de tener Firebase listo.
   No es un usuario ni una contraseña: no pide ningún dato y no toca ningún servidor,
   solo carga pedidos de ejemplo en el navegador. Antes de usar la app con
   repartidores reales, pon esto en false o borra este bloque, el archivo
   js/demo-data.js y la caja "demoBox" de index.html. */
export const DEMO_MODE = true;
