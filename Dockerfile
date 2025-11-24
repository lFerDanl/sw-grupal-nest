# ====================================
# 🚀 Backend NestJS (Node 20 Alpine)
# ====================================
FROM node:20-slim AS base
WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 \
    g++ \
    make \
    bash \
    curl \
    ffmpeg \
    git \
    libc6 \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

# Copiar archivos de dependencias
COPY package.json yarn.lock ./

# Instalar dependencias
RUN yarn install

# Copiar código fuente
COPY . .

# ====================================
# 🏗️ Build (solo si es producción)
# ====================================
FROM base AS builder
RUN yarn build

# ====================================
# 🧱 Runtime (para dev y prod)
# ====================================
FROM node:20-slim
WORKDIR /app

RUN apt-get update && apt-get install -y \
    bash \
    curl \
    ffmpeg \
    libc6 \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

# Crear usuario no-root
RUN groupadd -r nodejs && useradd -r -g nodejs -m nestjs

# Instalar dependencias de producción
COPY --from=base --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=base --chown=nestjs:nodejs /app/yarn.lock ./yarn.lock
RUN yarn install --production && yarn cache clean

# No copiamos código fuente de desarrollo en runtime

# Copiar build (para producción)
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Copiar modelos de Vosk necesarios en runtime
COPY --from=base --chown=nestjs:nodejs /app/models ./models

# Crear directorio uploads
RUN mkdir -p ./uploads && chown -R nestjs:nodejs ./uploads

# Variables de entorno por defecto
ENV NODE_ENV=production
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3001/health', r => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Comando dinámico según entorno
CMD ["/bin/sh", "-c", "if [ \"$NODE_ENV\" = 'development' ]; then yarn start:dev; else yarn start:prod; fi"]
