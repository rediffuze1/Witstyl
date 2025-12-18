import { motion } from 'framer-motion';
import Container from '@/components/ui/Container';
import { salonConfig } from '@/config/salon-config';
import { useSalonStylists } from '@/hooks/useSalonStylists';
import { User } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export default function Team() {
  const { data: stylistsFromApi, isLoading } = useSalonStylists();

  // Utiliser les stylistes depuis l'API, avec fallback sur la config (Pierre et Julie)
  const team = stylistsFromApi && Array.isArray(stylistsFromApi) && stylistsFromApi.length > 0
    ? stylistsFromApi
        .filter((s) => s.isActive !== false)
        .map((s) => ({
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName || '',
          role: s.specialties && s.specialties.length > 0 ? s.specialties[0] : 'Coiffeur/Coiffeuse',
          specialty: s.specialties && s.specialties.length > 1 ? s.specialties.slice(1).join(', ') : undefined,
          photo: s.photoUrl || undefined,
        }))
    : (salonConfig.team || []); // Fallback sur les données du salon (Pierre et Julie)

  // Toujours afficher la section, même si en chargement ou vide (utilisera le fallback)
  // Le fallback salonConfig.team contient toujours Pierre et Julie
  if (isLoading && !stylistsFromApi && (!team || team.length === 0)) {
    return (
      <section
        id="team"
        className="relative py-24 sm:py-28 lg:py-32"
        style={{ backgroundColor: 'hsl(var(--bg-section))' }}
      >
        <Container className="relative z-10">
          <div className="text-center">
            <p style={{ color: 'hsl(var(--text-muted))' }}>Chargement de l'équipe...</p>
          </div>
        </Container>
      </section>
    );
  }

  // Ne jamais retourner null - toujours afficher la section avec le fallback si nécessaire
  const displayTeam = team && team.length > 0 ? team : salonConfig.team;
  
  if (!displayTeam || displayTeam.length === 0) {
    // Si même le fallback est vide, afficher quand même la section avec un message
    return (
      <section
        id="team"
        className="relative py-24 sm:py-28 lg:py-32"
        style={{ backgroundColor: 'hsl(var(--bg-section))' }}
      >
        <Container className="relative z-10">
          <div className="text-center">
            <p style={{ color: 'hsl(var(--text-muted))' }}>Équipe en cours de chargement...</p>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section
      id="team"
      className="relative py-24 sm:py-28 lg:py-32"
      style={{ backgroundColor: 'hsl(var(--bg-section))' }}
    >
      <Container className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-semibold mb-4"
            style={{ color: 'hsl(var(--text-main))' }}
          >
            Notre équipe
          </h2>
          <p className="text-lg" style={{ color: 'hsl(var(--text-muted))' }}>
            Des professionnels passionnés à votre service
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
        >
          {team.map((member) => (
            <motion.div
              key={member.id}
              variants={itemVariants}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className="group relative rounded-3xl border p-6 backdrop-blur-xl text-center transition-all"
              style={{
                backgroundColor: 'hsla(var(--bg-section) / 0.8)',
                borderColor: 'hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.2)',
                boxShadow: '0 8px 32px hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.08)',
              }}
            >
              {/* Glow au hover */}
              <div
                className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at center, hsl(var(--brand-h) var(--brand-s) var(--brand-l) / 0.1), transparent 70%)`,
                }}
              />

              <div className="relative z-10">
                {/* Photo */}
                <div className="relative mx-auto mb-4 h-32 w-32 rounded-full overflow-hidden">
                  {member.photo ? (
                    <img
                      src={member.photo}
                      alt={member.firstName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{
                        backgroundColor: 'hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.1)',
                      }}
                    >
                      <User
                        className="h-16 w-16"
                        style={{ color: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))' }}
                      />
                    </div>
                  )}
                </div>

                <h3
                  className="text-xl font-semibold mb-1"
                  style={{ color: 'hsl(var(--text-main))' }}
                >
                  {member.firstName}
                </h3>

                <p
                  className="text-sm font-medium mb-2"
                  style={{ color: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))' }}
                >
                  {member.role}
                </p>

                {member.specialty && (
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'hsl(var(--text-muted))' }}
                  >
                    {member.specialty}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
}
