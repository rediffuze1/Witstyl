import { motion } from 'framer-motion';
import Container from '@/components/ui/Container';
import { useGoogleReviews } from '@/hooks/useGoogleReviews';
import { Star } from 'lucide-react';

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
  hidden: { opacity: 0, x: -30 },
  show: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-gray-200 text-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

export default function Reviews() {
  const { data, isLoading, error } = useGoogleReviews();
  
  // Debug logs
  console.log('[Reviews] data:', data);
  console.log('[Reviews] isLoading:', isLoading);
  console.log('[Reviews] error:', error);
  console.log('[Reviews] reviews count:', data?.reviews?.length || 0);

  return (
    <section
      id="reviews"
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
            Ce que disent nos clients
          </h2>
          <p className="text-lg" style={{ color: 'hsl(var(--text-muted))' }}>
            Découvrez les avis de nos clients satisfaits
          </p>
        </motion.div>

        {isLoading && (
          <div className="text-center py-12">
            <p style={{ color: 'hsl(var(--text-muted))' }}>Chargement des avis...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p style={{ color: 'hsl(var(--text-muted))' }}>
              Les avis ne sont pas disponibles pour le moment.
            </p>
          </div>
        )}

        {data && data.reviews && data.reviews.length > 0 && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-100px' }}
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {data.reviews.map((review) => (
              <motion.div
                key={review.id}
                variants={itemVariants}
                className="rounded-3xl border p-6 backdrop-blur-xl"
                style={{
                  backgroundColor: 'hsla(var(--bg-section) / 0.8)',
                  borderColor: 'hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.2)',
                  boxShadow: '0 8px 32px hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.08)',
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4
                      className="font-semibold mb-1"
                      style={{ color: 'hsl(var(--text-main))' }}
                    >
                      {review.authorName}
                    </h4>
                    <StarRating rating={review.rating} />
                  </div>
                  <span
                    className="text-xs px-2 py-1 rounded-full"
                    style={{
                      backgroundColor: 'hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.1)',
                      color: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))',
                    }}
                  >
                    Google
                  </span>
                </div>

                <p
                  className="text-sm leading-relaxed line-clamp-4"
                  style={{ color: 'hsl(var(--text-muted))' }}
                >
                  {review.text}
                </p>

                {review.relativeTimeDescription && (
                  <p
                    className="text-xs mt-4"
                    style={{ color: 'hsl(var(--text-muted))' }}
                  >
                    {review.relativeTimeDescription}
                  </p>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}

        {data && (!data.reviews || data.reviews.length === 0) && (
          <div className="text-center py-12">
            <p style={{ color: 'hsl(var(--text-muted))' }}>
              Aucun avis disponible pour le moment.
            </p>
          </div>
        )}
      </Container>
    </section>
  );
}




