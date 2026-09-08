const PUBLIC_GRID_DEGREES = 0.025;

export function approximateCoordinate(value: number): number {
  return Number((Math.round(value / PUBLIC_GRID_DEGREES) * PUBLIC_GRID_DEGREES).toFixed(3));
}

export function listingCoordinates(latitude?: number, longitude?: number) {
  if (latitude == null || longitude == null) return {
    exactLatitude: null, exactLongitude: null, approximateLatitude: null, approximateLongitude: null,
  };
  return {
    exactLatitude: latitude,
    exactLongitude: longitude,
    approximateLatitude: approximateCoordinate(latitude),
    approximateLongitude: approximateCoordinate(longitude),
  };
}
