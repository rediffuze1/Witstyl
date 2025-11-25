import { db } from "./db";
import { salons, services, stylistes, clients, appointments, users } from "@shared/schema";

async function seed() {
  try {
    console.log("Seeding database...");

    // Create a demo user first (salon owner)
    const [demoUser] = await db.insert(users).values({
      id: "demo-user-1",
      email: "salon@demo.com",
      firstName: "Salon",
      lastName: "Owner",
    }).returning();

    console.log("Created demo user:", demoUser.email);

    // Create demo salon
    const [demoSalon] = await db.insert(salons).values({
      id: "demo-salon-1",
      userId: demoUser.id,
      name: "Salon Éclat",
      address: "123 Rue de la Beauté, 75001 Paris",
      phone: "01 42 36 48 59",
      email: "contact@salon-eclat.fr",
    }).returning();

    console.log("Created demo salon:", demoSalon.name);

    // Create demo services
    const serviceData = [
      {
        id: "service-1",
        salonId: demoSalon.id,
        name: "Coupe Femme",
        description: "Coupe moderne avec conseils personnalisés",
        durationMinutes: 45,
        price: "35.00",
        tags: ["Coupe", "Femme"],
        requiresDeposit: false,
        bufferBefore: 15,
        bufferAfter: 15,
      },
      {
        id: "service-2", 
        salonId: demoSalon.id,
        name: "Coupe + Couleur",
        description: "Coupe avec coloration complète",
        durationMinutes: 120,
        price: "85.00",
        tags: ["Coupe", "Couleur", "Femme"],
        requiresDeposit: true,
        bufferBefore: 15,
        bufferAfter: 30,
      },
      {
        id: "service-3",
        salonId: demoSalon.id,
        name: "Brushing",
        description: "Brushing professionnel avec produits de qualité",
        durationMinutes: 30,
        price: "25.00",
        tags: ["Brushing", "Femme"],
        requiresDeposit: false,
        bufferBefore: 10,
        bufferAfter: 10,
      },
      {
        id: "service-4",
        salonId: demoSalon.id,
        name: "Coupe Homme",
        description: "Coupe masculine classique ou moderne",
        durationMinutes: 30,
        price: "28.00",
        tags: ["Coupe", "Homme"],
        requiresDeposit: false,
        bufferBefore: 10,
        bufferAfter: 10,
      },
      {
        id: "service-5",
        salonId: demoSalon.id,
        name: "Balayage",
        description: "Technique de coloration naturelle",
        durationMinutes: 180,
        price: "120.00",
        tags: ["Couleur", "Balayage", "Femme"],
        requiresDeposit: true,
        bufferBefore: 30,
        bufferAfter: 30,
      },
    ];

    await db.insert(services).values(serviceData);
    console.log("Created demo services:", serviceData.length);

    // Create demo stylistes
    const stylistData = [
      {
        id: "stylist-1",
        salonId: demoSalon.id,
        firstName: "Sarah",
        lastName: "Martin",
        email: "sarah@salon-eclat.fr",
        phone: "06 12 34 56 78",
        specialties: ["Coupe Femme", "Couleur", "Balayage"],
        isActive: true,
      },
      {
        id: "stylist-2",
        salonId: demoSalon.id,
        firstName: "Alex",
        lastName: "Dubois",
        email: "alex@salon-eclat.fr", 
        phone: "06 87 65 43 21",
        specialties: ["Coupe Homme", "Barber"],
        isActive: true,
      },
      {
        id: "stylist-3",
        salonId: demoSalon.id,
        firstName: "Emma",
        lastName: "Leroy",
        email: "emma@salon-eclat.fr",
        phone: "06 45 78 91 23",
        specialties: ["Brushing", "Coupe Femme", "Soins"],
        isActive: true,
      },
    ];

    await db.insert(stylistes).values(stylistData);
    console.log("Created demo stylistes:", stylistData.length);

    // Create demo clients
    const clientData = [
      {
        id: "client-1",
        firstName: "Marie",
        lastName: "Dubois", 
        email: "marie.dubois@email.com",
        phone: "06 11 22 33 44",
        preferredStylistId: "stylist-1",
        notes: "Préfère les coupes courtes",
      },
      {
        id: "client-2",
        firstName: "Jean",
        lastName: "Martin",
        email: "jean.martin@email.com",
        phone: "06 55 66 77 88",
        preferredStylistId: "stylist-2",
      },
      {
        id: "client-3",
        firstName: "Lisa",
        lastName: "Durand",
        email: "lisa.durand@email.com",
        phone: "06 99 88 77 66",
        preferredStylistId: "stylist-3",
        notes: "Cheveux sensibles",
      },
      {
        id: "client-4",
        firstName: "Pierre",
        lastName: "Roux",
        email: "pierre.roux@email.com",
        phone: "06 33 44 55 66",
      },
      {
        id: "client-5",
        firstName: "Sophie",
        lastName: "Bernard",
        email: "sophie.bernard@email.com",
        phone: "06 22 33 44 55",
        preferredStylistId: "stylist-1",
      },
    ];

    await db.insert(clients).values(clientData);
    console.log("Created demo clients:", clientData.length);

    // Create demo appointments for today and upcoming days
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const appointmentData = [
      {
        id: "appointment-1",
        salonId: demoSalon.id,
        clientId: "client-1",
        stylistId: "stylist-1",
        serviceId: "service-1",
        startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 30),
        endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 15),
        status: "confirmed",
        channel: "form",
        totalAmount: "35.00",
        paymentStatus: "paid",
      },
      {
        id: "appointment-2", 
        salonId: demoSalon.id,
        clientId: "client-2",
        stylistId: "stylist-2",
        serviceId: "service-4",
        startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 0),
        endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 30),
        status: "confirmed",
        channel: "voice",
        totalAmount: "28.00",
        paymentStatus: "paid",
      },
      {
        id: "appointment-3",
        salonId: demoSalon.id,
        clientId: "client-3",
        stylistId: "stylist-3",
        serviceId: "service-3",
        startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 45),
        endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 15),
        status: "pending",
        channel: "form",
        totalAmount: "25.00",
        paymentStatus: "pending",
      },
      {
        id: "appointment-4",
        salonId: demoSalon.id,
        clientId: "client-4",
        stylistId: "stylist-1",
        serviceId: "service-2",
        startTime: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 10, 0),
        endTime: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 12, 0),
        status: "confirmed",
        channel: "form",
        totalAmount: "85.00",
        depositAmount: "30.00",
        paymentStatus: "paid",
      },
      {
        id: "appointment-5",
        salonId: demoSalon.id,
        clientId: "client-5",
        stylistId: "stylist-1",
        serviceId: "service-5",
        startTime: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 14, 0),
        endTime: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 17, 0),
        status: "confirmed",
        channel: "voice",
        totalAmount: "120.00",
        depositAmount: "50.00",
        paymentStatus: "paid",
      },
    ];

    await db.insert(appointments).values(appointmentData);
    console.log("Created demo appointments:", appointmentData.length);

    console.log("Database seeded successfully!");
    console.log("Demo user credentials: salon@demo.com");
    console.log("You can now log in and explore the application.");

  } catch (error) {
    console.error("Seeding failed:", error);
    throw error;
  }
}

// Run if called directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.argv[1] === __filename) {
  seed().then(() => {
    console.log("Seed completed");
    process.exit(0);
  }).catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
}

export { seed };