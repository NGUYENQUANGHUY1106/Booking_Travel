FROM node:22-alpine AS build

WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/booking-travel-be/package.json apps/booking-travel-be/package.json
COPY apps/booking-travel-app/package.json apps/booking-travel-app/package.json
RUN npm ci --workspace @booking-travel/api --include-workspace-root

COPY apps/booking-travel-be apps/booking-travel-be
RUN npm run prisma:generate --workspace @booking-travel/api \
    && npm run build --workspace @booking-travel/api

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/booking-travel-be/dist ./apps/booking-travel-be/dist
COPY --from=build /workspace/apps/booking-travel-be/package.json ./apps/booking-travel-be/package.json

EXPOSE 3000
CMD ["node", "apps/booking-travel-be/dist/main.js"]
