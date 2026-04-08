import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Brand X Assessment Portal | Ideal Direct',
  description: 'Amazon Account Manager Assessment',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#EAEDED] min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
