import { useEffect } from 'react';
import {
  siteMetadata,
  organizationSchema,
  websiteSchema,
  softwareApplicationSchema,
  breadcrumbSchema,
  faqSchema,
} from '@/lib/seo';

export default function SEO() {
  useEffect(() => {
    // Update title
    document.title = siteMetadata.title;

    // Update or create meta tags
    const updateMetaTag = (name: string, content: string, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, name);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    // Basic meta tags
    updateMetaTag('description', siteMetadata.description);
    updateMetaTag('viewport', 'width=device-width, initial-scale=1.0');

    // Open Graph
    updateMetaTag('og:title', siteMetadata.title, true);
    updateMetaTag('og:description', siteMetadata.description, true);
    updateMetaTag('og:url', siteMetadata.url, true);
    updateMetaTag('og:type', siteMetadata.type, true);
    updateMetaTag('og:site_name', siteMetadata.siteName, true);
    updateMetaTag('og:locale', siteMetadata.locale, true);
    updateMetaTag('og:image', siteMetadata.image, true);

    // Twitter Card
    updateMetaTag('twitter:card', siteMetadata.twitterCard);
    updateMetaTag('twitter:title', siteMetadata.title);
    updateMetaTag('twitter:description', siteMetadata.description);
    updateMetaTag('twitter:image', siteMetadata.image);

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', siteMetadata.url);

    // hreflang
    let hreflang = document.querySelector('link[rel="alternate"][hreflang="fr-FR"]') as HTMLLinkElement;
    if (!hreflang) {
      hreflang = document.createElement('link');
      hreflang.setAttribute('rel', 'alternate');
      hreflang.setAttribute('hreflang', 'fr-FR');
      document.head.appendChild(hreflang);
    }
    hreflang.setAttribute('href', siteMetadata.url);

    let hreflangDefault = document.querySelector('link[rel="alternate"][hreflang="x-default"]') as HTMLLinkElement;
    if (!hreflangDefault) {
      hreflangDefault = document.createElement('link');
      hreflangDefault.setAttribute('rel', 'alternate');
      hreflangDefault.setAttribute('hreflang', 'x-default');
      document.head.appendChild(hreflangDefault);
    }
    hreflangDefault.setAttribute('href', siteMetadata.url);

    // JSON-LD Scripts
    const injectJSONLD = (id: string, schema: object) => {
      let script = document.getElementById(id) as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.id = id;
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(schema);
    };

    injectJSONLD('schema-organization', organizationSchema);
    injectJSONLD('schema-website', websiteSchema);
    injectJSONLD('schema-software', softwareApplicationSchema);
    injectJSONLD('schema-breadcrumb', breadcrumbSchema);
    injectJSONLD('schema-faq', faqSchema);
  }, []);

  return null;
}








