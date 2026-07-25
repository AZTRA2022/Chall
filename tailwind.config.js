/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      borderRadius: {
        // Échelle dérivée de --radius (6px). Registre technique : des rayons
        // serrés, qui montent seulement avec la taille de la surface.
        //   sm  4px  — cases à cocher, badges, puces, code inline
        //   md  6px  — boutons, champs, vignettes
        //   lg 10px  — cartes
        //   xl 14px  — modales, feuilles
        //   full     — avatars, interrupteurs
        sm: "calc(var(--radius) - 2px)",
        md: "var(--radius)",
        lg: "calc(var(--radius) + 4px)",
        xl: "calc(var(--radius) + 8px)",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          // Rouge lisible en texte/icône sur le fond du thème courant.
          // `bg-primary` sert aux aplats, `text-primary-ink` au texte.
          ink: "hsl(var(--primary-ink))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      fontFamily: {
        // React Native ignores font-weight on custom fonts — each weight
        // needs its own family token loaded via useFonts() in _layout.tsx.
        sans: ["Inter_400Regular"],
        "sans-medium": ["Inter_500Medium"],
        "sans-semibold": ["Inter_600SemiBold"],
        "sans-bold": ["Inter_700Bold"],
        display: ["BebasNeue_400Regular"],
        mono: ["JetBrainsMono_400Regular"],
        "mono-bold": ["JetBrainsMono_700Bold"],
      },
      fontSize: {
        // Échelle Bebas Neue : titres d'écran et grands nombres. Toujours en
        // capitales, avec `font-display`.
        "display-sm": ["40px", { lineHeight: "40px" }],
        "display-md": ["56px", { lineHeight: "54px" }],
        "display-lg": ["72px", { lineHeight: "68px" }],
        "display-xl": ["96px", { lineHeight: "90px" }],
        // Libellés `meta` : JetBrains Mono en capitales espacées, pour les
        // métadonnées (catégorie, domaine, taille, compteurs, statut).
        meta: ["11px", { lineHeight: "14px" }],
        "meta-lg": ["13px", { lineHeight: "16px" }],
      },
      letterSpacing: {
        // React Native attend des points, pas des `em`. 1.8 ≈ 0.16em à 11px.
        meta: "1.8px",
        "meta-wide": "2.4px",
      },
    },
  },
  plugins: [],
};
