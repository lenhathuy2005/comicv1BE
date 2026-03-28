# API Overview

## Auth
- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/auth/me`
- POST `/api/auth/forgot-password`
- POST `/api/auth/reset-password`
- POST `/api/auth/refresh-token`
- POST `/api/auth/logout`

## Users
- GET `/api/users`
- GET `/api/users/:id`
- PATCH `/api/users/:id/status`

## Comics
- GET `/api/comics`
- GET `/api/comics/:id`
- POST `/api/comics`
- PUT `/api/comics/:id`

## Guilds
- GET `/api/guilds`
- GET `/api/guilds/:id`
- POST `/api/guilds`
- POST `/api/guilds/:id/join-requests`
- POST `/api/guilds/join-requests/:requestId/approve`
- POST `/api/guilds/:id/donations`

## VIP
- GET `/api/vip/levels`
- GET `/api/vip/features`
- GET `/api/vip/me`

## AFK
- GET `/api/afk/configs`
- POST `/api/afk/sessions`
- POST `/api/afk/sessions/:id/finish`
- POST `/api/afk/sessions/:id/claim`

## Shop
- GET `/api/shop/items`
- POST `/api/shop/items/:shopItemId/buy`

## Chat
- GET `/api/chat/rooms`
- GET `/api/chat/rooms/:roomId/messages`
- POST `/api/chat/rooms/:roomId/messages`

## Notifications
- GET `/api/notifications/me`
- PATCH `/api/notifications/:id/read`
