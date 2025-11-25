// Script de test pour créer un rendez-vous
// Simule exactement ce que le frontend envoie

const testAppointment = async () => {
  // Données de test (à adapter selon votre base de données)
  const appointmentData = {
    salonId: "salon-c152118c-478b-497b-98db-db37a4c58898",
    clientId: "test-client-id", // Remplacer par un vrai ID
    serviceId: "test-service-id", // Remplacer par un vrai ID
    stylistId: "test-stylist-id", // Remplacer par un vrai ID
    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Demain à la même heure
    status: "confirmed",
    notes: "Test de création depuis script",
    duration: 30
  };

  console.log("🧪 Test de création de rendez-vous...");
  console.log("📤 Données envoyées:", JSON.stringify(appointmentData, null, 2));

  try {
    const response = await fetch("http://localhost:5001/api/appointments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(appointmentData),
      credentials: "include",
    });

    const responseText = await response.text();
    console.log(`📊 Code HTTP: ${response.status}`);
    console.log("📄 Réponse:", responseText);

    if (!response.ok) {
      try {
        const errorData = JSON.parse(responseText);
        console.error("❌ Erreur:", errorData);
      } catch {
        console.error("❌ Erreur (texte brut):", responseText);
      }
    } else {
      try {
        const data = JSON.parse(responseText);
        console.log("✅ Rendez-vous créé avec succès!");
        console.log("📋 Données:", JSON.stringify(data, null, 2));
      } catch {
        console.log("✅ Réponse reçue (non-JSON):", responseText);
      }
    }
  } catch (error) {
    console.error("❌ Erreur réseau:", error.message);
  }
};

// Exécuter le test
testAppointment();



