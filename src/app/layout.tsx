import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Talisman: a 3D action MOBA",
  description: "Heroes of old legend in a duel arena where nothing locks on. Dawn vs Dusk.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Talisman",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  applicationName: "Talisman",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              /*
                NEVER in development.

                sw.js serves /_next/ cache-first, and Next's dev chunk URLs are
                NOT content hashed, so once a chunk is cached the browser keeps
                serving the old code after every edit. A change to a component
                simply does not appear, which reads as the change not working
                rather than as a caching problem. It cost a full afternoon here.

                Production chunk names ARE hashed, so cache-first is fine there.
              */
              if (${JSON.stringify(process.env.NODE_ENV)} === 'production' && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.log('[talisman sw] registration failed: ', err);
                  });
                });
              } else if ('serviceWorker' in navigator) {
                /* Unregister anything left over from a previous dev session and
                   drop its caches, or the stale bundle survives this fix. */
                navigator.serviceWorker.getRegistrations().then(function (rs) {
                  rs.forEach(function (r) { r.unregister(); });
                });
                if (window.caches) {
                  caches.keys().then(function (ks) {
                    ks.forEach(function (k) { if (k.indexOf('talisman') === 0) caches.delete(k); });
                  });
                }
              }
            `,
          }}
        />
      </body>
    </html>
  );
}

