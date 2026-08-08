# 📸 Photo Booth

Two-person live photo booth for mobile browsers.

## Features

- Create a random 6-character room
- Join from another phone with the room code
- Live camera-to-camera connection with WebRTC
- Synchronized 3-second countdown
- Four-shot session
- Automatic vertical four-photo strip
- Download as PNG
- Native mobile share when supported
- Mobile-first dark cinematic UI

## Supabase setup

This project uses Supabase Realtime Broadcast for WebRTC signaling. No database tables are required for the current version.

1. Open `config.js`.
2. Set `SUPABASE_URL` to your Supabase project URL.
3. Set `SUPABASE_KEY` to your project's **publishable/anon client key**.
4. Keep the key client-side only if it is a publishable/anon key. Never put a `service_role` or secret key in this repository.

`config.example.js` is included as a template.

## GitHub Pages

Enable **Settings → Pages → Deploy from branch → main → / (root)**.

Camera access requires a secure context, so use the GitHub Pages HTTPS URL rather than an insecure HTTP URL.

## How it works

- Supabase Realtime Broadcast is used only as a signaling channel.
- WebRTC carries the live camera stream directly between the two browsers.
- The host starts each countdown and captures the combined local/remote frame.
- The host sends each compressed shot to the guest over the signaling channel.
- Both browsers assemble the same four-shot strip locally.

For production use, add authentication, room expiry, rate limiting, and a TURN server for networks where direct WebRTC connectivity is unavailable.
