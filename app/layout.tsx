import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ideal Direct Brand Manager Recruitment Portal',
  description: 'Brand Manager Recruitment Assessment',
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
