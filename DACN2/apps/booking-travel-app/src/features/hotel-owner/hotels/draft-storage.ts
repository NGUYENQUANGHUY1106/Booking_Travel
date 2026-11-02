export function ownerHotelDraftKey(userId: string, sessionId: string, hotelId = 'new') {
  return `owner-hotel-draft:v1:${userId}:${sessionId}:${hotelId}`;
}
