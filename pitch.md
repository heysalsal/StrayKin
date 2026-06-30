# Straykin: A Community-Driven Platform for Stray Cat Care

## Overview
**Straykin** is a full-stack, community-driven web application designed to track, care for, and manage stray cat populations. Built with the goal of improving the lives of street cats through collective effort, it empowers local communities to document sightings, track feeding schedules, verify TNR (Trap-Neuter-Return) status, and connect with nearby animal welfare hubs.

## The Problem
Stray and feral cats often lack consistent care, and local communities struggle to coordinate feeding efforts or monitor their health. Without a centralized system, it is difficult to know which cats have been neutered, when they were last fed, or if they need medical attention.

## The Solution
Straykin gamifies and organizes stray cat care. It provides an interactive map where users can log sightings, update care histories, and earn rewards for their contributions. By connecting everyday caretakers with established shelters, vet clinics, and pet shops (Community Hubs), Straykin creates a cohesive ecosystem for feline welfare.

---

## Core Features

### 🗺️ Interactive Community Map
- **Real-Time Tracking:** Users can pin cat sightings on a live map using Geolocation and Geohashing.
- **Dynamic Filtering:** Toggle map pins for Strays, Vet Clinics, Shelters, Cat Cafes, and Pet Shops.
- **Smart Visual Indicators:** Map markers automatically update based on the cat's status (e.g., recently fed cats are highlighted in green, unfed cats in orange). Custom markers display the cat's uploaded photo instead of generic icons.

### 🐾 Comprehensive Pet Profiles
- **Crowdsourced Identity:** Community members can suggest and upvote names, traits, and characteristics for each stray.
- **Care History & Check-Ins:** Users log when they feed a cat or note its TNR (sterilization) status, preventing overfeeding and ensuring health monitoring.
- **Resident Pets:** Strays located within a 300m radius of a registered "Hub" (like a cafe or shelter) are automatically flagged as "Resident Pets."

### 🏛️ Hub Center
- **Local Ecosystem:** Users can propose and discover nearby animal welfare hubs (Shelters, Vets, Pet Shops, Cafes).
- **Proposals & Moderation:** New hub submissions are sent for review (via a Telegram Bot integration or Firebase auto-approval) to ensure data quality.

### 🎮 Gamification & Engagement
- **XP & Badges:** Caretakers earn experience points (XP), unlock achievements, and gain titles (e.g., "Novice Feeder", "Stray Guardian") based on their check-ins and sightings.
- **Leaderboards & Titles:** Encourages consistent community participation through rewarding positive actions.

### 🛡️ Moderation & Telegram Integration
- **Backend Review System:** Submissions for new cats, photos, or hubs can be routed to a Telegram Bot where administrators can approve or reject them, or auto-approved directly via the server backend.

---

## Technical Architecture

- **Frontend:** React, TypeScript, Tailwind CSS, Framer Motion (for smooth UI animations).
- **Mapping:** React-Leaflet with OpenStreetMap integration and Geofire-common for spatial queries.
- **Backend & API:** Node.js, Express (compiled via ESBuild for production).
- **Database & Auth:** Firebase Firestore (NoSQL database with geospatial querying) and Firebase Authentication (Anonymous & Google Auth).
- **Image Hosting:** External CDN integration (Bunny.net) for scalable image storage.
- **Deployment:** Dockerized and deployed via Google Cloud Run.

## Why This Project Stands Out
Straykin demonstrates a strong balance between a clean, mobile-first User Experience and complex backend logic. It tackles a real-world problem by blending geospatial data, crowdsourced content, gamification, and robust community moderation into a highly polished application. It shows proficiency in:
- Managing complex, real-time spatial data.
- Building engaging, interactive, and responsive UI components.
- Designing scalable NoSQL database schemas.
- Integrating third-party services and webhooks (Telegram, CDNs).
