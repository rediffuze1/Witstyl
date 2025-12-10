import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Container from '@/components/ui/Container';
import { salonConfig } from '@/config/salon-config';
import { ChevronDown } from 'lucide-react';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section
      id="faq"
      className="relative py-24 sm:py-28 lg:py-32"
      style={{ backgroundColor: 'hsl(var(--bg-page))' }}
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
            Questions fréquentes
          </h2>
          <p className="text-lg" style={{ color: 'hsl(var(--text-muted))' }}>
            Tout ce que vous devez savoir sur nos services
          </p>
        </motion.div>

        <div className="max-w-3xl mx-auto space-y-4">
          {salonConfig.faq.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              className="rounded-2xl border overflow-hidden backdrop-blur-xl"
              style={{
                backgroundColor: 'hsla(var(--bg-section) / 0.8)',
                borderColor: 'hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.2)',
              }}
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-opacity-50 transition-colors"
                style={{
                  backgroundColor: openIndex === index ? 'hsla(var(--brand-h) var(--brand-s) var(--brand-l) / 0.05)' : 'transparent',
                }}
              >
                <span className="font-semibold pr-4" style={{ color: 'hsl(var(--text-main))' }}>
                  {faq.question}
                </span>
                <motion.div
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ChevronDown
                    className="h-5 w-5 flex-shrink-0"
                    style={{ color: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))' }}
                  />
                </motion.div>
              </button>

              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5 text-sm leading-relaxed" style={{ color: 'hsl(var(--text-muted))' }}>
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
