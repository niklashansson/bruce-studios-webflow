/**
 * Attempts to get the user's current location using the Geolocation API.
 * Returns a promise that resolves with coordinates or rejects if unavailable.
 */
export function getUserLocation(): Promise<[number, number]> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        resolve([longitude, latitude]);
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: false, // Don't need high accuracy for map centering
        timeout: 5000, // 5 second timeout
        maximumAge: 300000, // Cache position for 5 minutes
      }
    );
  });
}
