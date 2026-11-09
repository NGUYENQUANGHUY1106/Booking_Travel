import { HotelMediaStatus, PrismaClient } from '@prisma/client';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const prisma = new PrismaClient();

async function main() {
  const localStorage =
    !process.env.R2_ENDPOINT &&
    !process.env.R2_BUCKET &&
    !process.env.R2_ACCESS_KEY_ID;
  const localDir = resolve(process.env.LOCAL_MEDIA_DIR ?? '../../.local-media');
  const hotels = await prisma.hotel.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      status: true,
      rooms: {
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          media: {
            where: {
              status: HotelMediaStatus.READY,
              deletedAt: null,
            },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: {
              id: true,
              objectKey: true,
              mimeType: true,
              expectedSize: true,
              sortOrder: true,
            },
          },
        },
      },
    },
  });
  const roomReports = await Promise.all(
    hotels.flatMap((hotel) =>
      hotel.rooms.map(async (room) => {
        const files = await Promise.all(
          room.media.map(async (media) => ({
            ...media,
            storageAvailable: localStorage
              ? await stat(resolve(localDir, media.id))
                  .then((file) => file.size === media.expectedSize)
                  .catch(() => false)
              : null,
          })),
        );
        const validCount = files.filter(
          (file) => file.storageAvailable !== false,
        ).length;
        return {
          hotelId: hotel.id,
          hotelName: hotel.name,
          hotelStatus: hotel.status,
          roomId: room.id,
          roomName: room.name,
          roomType: room.type,
          roomStatus: room.status,
          imageCount: room.media.length,
          validStorageCount: validCount,
          classification:
            validCount === 0
              ? 'NO_IMAGES'
              : validCount < 3
                ? 'ONLY_1_OR_2_IMAGES'
                : validCount <= 5
                  ? 'HAS_3_TO_5_IMAGES'
                  : 'MORE_THAN_5_IMAGES',
          images: files,
        };
      }),
    ),
  );
  console.log(
    JSON.stringify(
      {
        auditedAt: new Date().toISOString(),
        storageMode: localStorage ? 'local' : 'r2',
        hotelCount: hotels.length,
        roomCount: roomReports.length,
        roomsWithValidImages: roomReports.filter(
          (room) => room.validStorageCount > 0,
        ).length,
        roomsMissingImages: roomReports.filter(
          (room) => room.validStorageCount === 0,
        ).length,
        rooms: roomReports,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
