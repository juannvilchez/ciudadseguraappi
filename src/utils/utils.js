 // Formatea el tiempo (mm:ss)
 export const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  // Filtro de Kalman con ajuste dinámico según la precisión (accuracy)
  export class KalmanFilter {
    constructor({ R, Q, A = 1, B = 0, C = 1 }) {
      this.R = R; // Ruido de medición
      this.Q = Q; // Ruido del proceso
      this.A = A;
      this.B = B;
      this.C = C;
      this.x = NaN; // Estado inicial
      this.cov = NaN; // Covarianza inicial
    }
  
    adjustParameters(accuracy) {
      if (accuracy > 10) {
        this.R = 0.001;
        this.Q = 0.0005;
      } else {
        this.R = 0.0001;
        this.Q = 0.00001;
      }
    }
  
    filter(z, accuracy, u = 0) {
      this.adjustParameters(accuracy);
      if (isNaN(this.x)) {
        this.x = z / this.C;
        this.cov = (1 / this.C) * this.R * (1 / this.C);
      } else {
        const predX = this.A * this.x + this.B * u;
        const predCov = this.A * this.cov * this.A + this.Q;
        const K = (predCov * this.C) / (this.C * predCov * this.C + this.R);
        this.x = predX + K * (z - this.C * predX);
        this.cov = predCov - K * this.C * predCov;
      }
      return this.x;
    }
  }

  // Función para calcular la distancia (en metros) entre dos coordenadas usando la fórmula de Haversine
export const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Radio de la Tierra en metros
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

//funcion de validacion de email
export const validateEmail = (email) => {
  const re = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
  return re.test(email);
};