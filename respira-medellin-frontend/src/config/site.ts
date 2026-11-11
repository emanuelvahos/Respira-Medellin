export const siteConfig = {
  name: "Respira Medellín",
  shortName: "Respira Medellín",
  description:
    "Plataforma de datos abiertos para la arborización urbana y la mitigación de PM2.5 en Medellín. Un laboratorio de ciencia de datos ambiental al servicio de la ciudad.",
  institution: "Secretaría de Medio Ambiente de Medellín",
  locale: "es-CO",
  nav: [
    { label: "Inicio", href: "/" },
    { label: "Mapa", href: "/mapa" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Recomendaciones", href: "/#recomendacion" },
    { label: "Metodología", href: "/#metodologia-ahp" },
  ],
  footerLinks: [
    { label: "Datos abiertos", href: "#" },
    { label: "Metodología AHP", href: "#" },
    { label: "Contacto", href: "#" },
    { label: "Aviso de privacidad", href: "#" },
  ],
} as const;
