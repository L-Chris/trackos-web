FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_BASE_URL
ARG VITE_AMAP_KEY
ARG VITE_AMAP_SECURITY_JS_CODE

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_AMAP_KEY=$VITE_AMAP_KEY
ENV VITE_AMAP_SECURITY_JS_CODE=$VITE_AMAP_SECURITY_JS_CODE

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app

RUN npm install --global serve

COPY --from=build /app/dist ./dist

EXPOSE 6001

CMD ["serve", "-s", "dist", "-l", "6001"]