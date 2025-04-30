'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Package, Map, CheckCircle, Truck, User, Menu, X } from 'lucide-react';

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Handle scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Feature cards data
  const features = [
    {
      icon: <Package size={24} />,
      title: 'Post a Package',
      description:
        'Create a new delivery request with location and destination',
      link: '/post-package',
      color: 'from-[#FF7170] to-[#FFE57F]',
    },
    {
      icon: <Map size={24} />,
      title: 'View Packages',
      description: 'Browse available packages on an interactive map',
      link: '/view-packages',
      color: 'from-[#0EA5E9] to-[#22D3EE]',
    },
    {
      icon: <Truck size={24} />,
      title: 'My Deliveries',
      description: "Track packages you've picked up and confirm deliveries",
      link: '/my-deliveries',
      color: 'from-[#8B5CF6] to-[#C084FC]',
    },
    {
      icon: <CheckCircle size={24} />,
      title: 'Confirm Delivery',
      description: 'Scan QR code to confirm package delivery',
      link: '/confirm-delivery',
      color: 'from-[#10B981] to-[#34D399]',
    },
    {
      icon: <User size={24} />,
      title: 'Profile',
      description: 'View your profile and reputation',
      link: '/profile',
      color: 'from-[#F59E0B] to-[#FBBF24]',
    },
  ];

  return (
    <main className='min-h-screen bg-white text-gray-800 overflow-hidden'>
      {/* Navbar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white/80 backdrop-blur-lg shadow-md' : 'bg-transparent'
        }`}
      >
        <div className='container mx-auto px-4 py-4 flex justify-between items-center'>
          <Link href='/' className='flex items-center gap-2'>
            <div className='bg-gradient-to-r from-[#FF7170] to-[#FFE57F] rounded-full p-2'>
              <Package className='h-5 w-5 text-white' />
            </div>
            <span className='font-bold text-xl text-gray-900'>A to ₿</span>
          </Link>

          {/* Desktop Navigation */}
          <div className='hidden md:flex items-center gap-6'>
            <Link
              href='/post-package'
              className='text-gray-600 hover:text-[#FF7170] transition-colors'
            >
              Post Package
            </Link>
            <Link
              href='/view-packages'
              className='text-gray-600 hover:text-[#22D3EE] transition-colors'
            >
              View Map
            </Link>
            <Link
              href='/my-deliveries'
              className='text-gray-600 hover:text-[#C084FC] transition-colors'
            >
              My Deliveries
            </Link>
            <Link
              href='/profile'
              className='bg-gradient-to-r from-[#FF7170] to-[#FFE57F] text-white px-4 py-2 rounded-full font-medium hover:shadow-glow-orange transition-all'
            >
              Profile
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className='md:hidden text-gray-800'
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className='md:hidden bg-white border-t border-gray-100 shadow-lg animate-fade-in'>
            <div className='container mx-auto px-4 py-4 flex flex-col gap-4'>
              <Link
                href='/post-package'
                className='py-3 px-4 hover:bg-gray-50 rounded-lg transition-colors text-gray-800'
                onClick={() => setIsMenuOpen(false)}
              >
                Post Package
              </Link>
              <Link
                href='/view-packages'
                className='py-3 px-4 hover:bg-gray-50 rounded-lg transition-colors text-gray-800'
                onClick={() => setIsMenuOpen(false)}
              >
                View Map
              </Link>
              <Link
                href='/my-deliveries'
                className='py-3 px-4 hover:bg-gray-50 rounded-lg transition-colors text-gray-800'
                onClick={() => setIsMenuOpen(false)}
              >
                My Deliveries
              </Link>
              <Link
                href='/profile'
                className='py-3 px-4 bg-gradient-to-r from-[#FF7170] to-[#FFE57F] text-white rounded-lg font-medium'
                onClick={() => setIsMenuOpen(false)}
              >
                Profile
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section with Background Image */}
      <section className='relative pt-32 pb-32 overflow-hidden'>
        <div className='container mx-auto px-4 relative z-20'>
          <div className='max-w-2xl'>
            {/* Left Content */}
            <div className='flex flex-col items-start text-left'>
              <div className='inline-flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full px-4 py-2 mb-6'>
                <span className='inline-block w-2 h-2 rounded-full bg-[#FF7170]'></span>
                <span className='text-sm font-medium text-gray-700'>
                  Decentralized Delivery Platform
                </span>
              </div>

              <h1 className='text-4xl md:text-6xl font-bold mb-6 leading-tight text-gray-900'>
                Move Packages,
                <br />
                Build Reputation,
                <span className='block bg-gradient-to-r from-[#FF7170] to-[#FFE57F] text-transparent bg-clip-text'>
                  Stack Sats.
                </span>
              </h1>

              <p className='text-lg text-gray-600 mb-8 max-w-lg'>
                A to ₿ connects people who need packages delivered with those
                who can deliver them, all powered by Nostr and Bitcoin
                technology.
              </p>

              <div className='flex flex-wrap gap-4'>
                <Link href='/post-package'>
                  <button className='px-8 py-4 bg-gradient-to-r from-[#FF7170] to-[#FFE57F] rounded-full text-white font-medium hover:shadow-glow-orange transform hover:-translate-y-1 transition-all duration-300 cursor-pointer'>
                    Post a Package
                  </button>
                </Link>
                <Link href='/view-packages'>
                  <button className='px-8 py-4 bg-gray-50 border border-gray-200 rounded-full font-medium text-gray-700 hover:border-gray-300 transform hover:-translate-y-1 transition-all duration-300 cursor-pointer'>
                    View Map
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
        \
        <div className='absolute top-0 left-[5%] md:left-[2%] lg:left-[5%] w-[250px] md:w-[280px] lg:w-[300px] h-[250px] md:h-[280px] lg:h-[300px] rounded-full bg-[#FF7170] opacity-10 md:opacity-8 lg:opacity-10 blur-[80px] md:blur-[90px] lg:blur-[100px]'></div>
        <div className='absolute top-[30%] right-0 md:right-[-5%] lg:right-0 w-[300px] md:w-[350px] lg:w-[400px] h-[300px] md:h-[350px] lg:h-[400px] rounded-full bg-[#22D3EE] opacity-10 md:opacity-8 lg:opacity-10 blur-[80px] md:blur-[90px] lg:blur-[100px]'></div>
        <div className='absolute bottom-[10%] left-0 md:left-[-5%] lg:left-0 w-[250px] md:w-[300px] lg:w-[350px] h-[250px] md:h-[300px] lg:h-[350px] rounded-full bg-[#C084FC] opacity-10 md:opacity-8 lg:opacity-10 blur-[80px] md:blur-[90px] lg:blur-[100px]'></div>
        <div className='absolute top-[15%] right-[20%] md:right-[15%] lg:right-[20%] w-[250px] md:w-[300px] lg:w-[350px] h-[250px] md:h-[300px] lg:h-[350px] rounded-full bg-[#8B5CF6] opacity-10 md:opacity-8 lg:opacity-10 blur-[80px] md:blur-[90px] lg:blur-[100px]'></div>
        {/* Additional orb for medium screens to fill potential gaps */}
        <div className='hidden md:block lg:hidden absolute top-[60%] right-[40%] w-[280px] h-[280px] rounded-full bg-[#FF7170] opacity-8 blur-[90px]'></div>
        {/* Hero Image - Hidden on mobile, positioned behind content on desktop */}
        <div className='hidden md:block absolute right-0 top-0 w-[65%] h-full z-10 overflow-hidden'>
          <div className='absolute inset-0 bg-gradient-to-l from-transparent to-white w-[30%] z-10'></div>
          <Image
            src='/logistics-app.png'
            alt='Logistics app interface showing package tracking and delivery features'
            width={1200}
            height={800}
            className='w-full h-full object-contain object-right animate-float'
            priority
          />
        </div>
      </section>

      {/* Wave Separator */}
      <div className='wave-separator'>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          viewBox='0 0 1440 320'
          preserveAspectRatio='none'
        >
          <defs>
            <linearGradient
              id='wave-gradient'
              x1='0%'
              y1='0%'
              x2='100%'
              y2='0%'
            >
              <stop offset='0%' stopColor='#FF7170' />
              <stop offset='100%' stopColor='#FFE57F' />
            </linearGradient>
          </defs>
          <path
            fill='url(#wave-gradient)'
            fillOpacity='1'
            d='M0,96L48,112C96,128,192,160,288,186.7C384,213,480,235,576,224C672,213,768,171,864,149.3C960,128,1056,128,1152,149.3C1248,171,1344,213,1392,234.7L1440,256L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z'
          ></path>
        </svg>
      </div>

      {/* Features Section */}
      <section className='py-20 relative features-section'>
        <div className='container mx-auto px-4'>
          <div className='text-center mb-16'>
            <h2 className='text-4xl md:text-5xl font-extrabold mb-4 text-black tracking-tight'>
              Powerful Features
            </h2>
            <p className='text-gray-600 max-w-2xl mx-auto'>
              Everything you need to send and receive packages in a
              decentralized way
            </p>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'>
            {features.map((feature, index) => (
              <Link href={feature.link} key={index} className='block group'>
                <div className='h-full bg-white border border-gray-100 rounded-2xl p-6 hover:border-opacity-0 transition-all duration-300 hover:shadow-xl relative overflow-hidden group-hover:transform group-hover:-translate-y-2'>
                  {/* Gradient background that appears on hover */}
                  <div className='absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-300 z-0'></div>

                  {/* Icon with gradient background */}
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-r ${feature.color} flex items-center justify-center mb-4`}
                  >
                    <div className='text-white'>{feature.icon}</div>
                  </div>

                  <h3 className='text-xl font-bold mb-2 relative z-10 text-gray-900'>
                    {feature.title}
                  </h3>
                  <p className='text-gray-600 mb-4 relative z-10'>
                    {feature.description}
                  </p>

                  <div className='mt-4 relative z-10'>
                    <span className='inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-[#FF7170] to-[#FFE57F] text-white text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-orange-300/30 hover:-translate-y-1'>
                      Learn more
                      <svg
                        className='ml-2 h-4 w-4'
                        viewBox='0 0 24 24'
                        fill='none'
                        xmlns='http://www.w3.org/2000/svg'
                      >
                        <path
                          d='M5 12H19M19 12L12 5M19 12L12 19'
                          stroke='currentColor'
                          strokeWidth='2'
                          strokeLinecap='round'
                          strokeLinejoin='round'
                        />
                      </svg>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className='py-20 relative bg-gray-50'>
        <div className='absolute inset-0 z-0'>
          <div className='absolute top-[20%] right-[10%] w-[300px] h-[300px] rounded-full bg-[#8B5CF6] opacity-5 blur-[100px]'></div>
          <div className='absolute bottom-[10%] left-[10%] w-[250px] h-[250px] rounded-full bg-[#FF7170] opacity-5 blur-[100px]'></div>
        </div>

        <div className='container mx-auto px-4 relative z-10'>
          <div className='text-center mb-16'>
            <h2 className='text-4xl md:text-5xl font-bold mb-4 text-gray-900'>
              <span className='bg-gradient-to-r from-[#8B5CF6] to-[#C084FC] text-transparent bg-clip-text'>
                How It Works
              </span>
            </h2>
            <p className='text-gray-600 max-w-2xl mx-auto'>
              Simple steps to get your package delivered
            </p>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
            {/* Step 1 */}
            <div className='relative'>
              <div className='bg-white border border-gray-100 rounded-2xl p-6 h-full shadow-sm'>
                <div className='w-12 h-12 rounded-full bg-gradient-to-r from-[#FF7170] to-[#FFE57F] flex items-center justify-center mb-6 text-white font-bold'>
                  1
                </div>
                <h3 className='text-xl font-bold mb-4 text-gray-900'>
                  Post Your Package
                </h3>
                <p className='text-gray-600'>
                  Create a delivery request with pickup location, destination,
                  and payment amount in Bitcoin.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className='relative'>
              <div className='bg-white border border-gray-100 rounded-2xl p-6 h-full shadow-sm'>
                <div className='w-12 h-12 rounded-full bg-gradient-to-r from-[#0EA5E9] to-[#22D3EE] flex items-center justify-center mb-6 text-white font-bold'>
                  2
                </div>
                <h3 className='text-xl font-bold mb-4 text-gray-900'>
                  Courier Picks Up
                </h3>
                <p className='text-gray-600'>
                  A nearby courier accepts your delivery request and picks up
                  your package.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div>
              <div className='bg-white border border-gray-100 rounded-2xl p-6 h-full shadow-sm'>
                <div className='w-12 h-12 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#C084FC] flex items-center justify-center mb-6 text-white font-bold'>
                  3
                </div>
                <h3 className='text-xl font-bold mb-4 text-gray-900'>
                  Delivery Confirmation
                </h3>
                <p className='text-gray-600'>
                  Recipient scans QR code to confirm delivery and release
                  Bitcoin payment.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className='py-20'>
        <div className='container mx-auto px-4'>
          <div className='bg-gradient-to-r from-[#F8FAFC] to-[#F1F5F9] border border-gray-100 rounded-3xl p-8 md:p-12 relative overflow-hidden shadow-lg'>
            {/* Background Elements */}
            <div className='absolute inset-0 z-0'>
              <div className='absolute top-0 right-0 w-[300px] h-[300px] rounded-full bg-[#FF7170] opacity-5 blur-[100px]'></div>
              <div className='absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-[#22D3EE] opacity-5 blur-[100px]'></div>
            </div>

            <div className='relative z-10 flex flex-col md:flex-row items-center justify-between gap-8'>
              <div>
                <h2 className='text-3xl md:text-4xl font-bold mb-4 text-gray-900 text-center'>
                  Ready to get started?
                </h2>
                <p className='text-gray-600 max-w-lg text-center'>
                  Join the decentralized delivery revolution today and
                  experience the future of package delivery.
                </p>
              </div>
              <div className='flex flex-wrap gap-2'>
                <Link href='/post-package'>
                  <button className='px-8 py-4 bg-gradient-to-r from-[#FF7170] to-[#FFE57F] rounded-full text-white font-medium hover:shadow-glow-orange transform hover:-translate-y-1 transition-all duration-300 cursor-pointer'>
                    Post a Package
                  </button>
                </Link>
                <Link href='/view-packages'>
                  <button className='px-8 py-4 bg-white border border-gray-200 rounded-full font-medium text-gray-700 hover:border-gray-300 transform hover:-translate-y-1 transition-all duration-300 cursor-pointer'>
                    View Map
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className='bg-white border-t border-gray-100 py-12'>
        <div className='container mx-auto px-4'>
          <div className='flex flex-col md:flex-row justify-between items-center'>
            <div className='flex items-center gap-2 mb-6 md:mb-0'>
              <div className='bg-gradient-to-r from-[#FF7170] to-[#FFE57F] rounded-full p-2'>
                <Package className='h-5 w-5 text-white' />
              </div>
              <span className='font-bold text-xl text-gray-900'>A to ₿</span>
            </div>

            {/* <div className='flex gap-4'>
              <a
                href='#'
                className='w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-600'
              >
                <svg
                  width='20'
                  height='20'
                  fill='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path d='M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z'></path>
                </svg>
              </a>
              <a
                href='#'
                className='w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-600'
              >
                <svg
                  width='20'
                  height='20'
                  fill='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path d='M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z'></path>
                </svg>
              </a>
              <a
                href='#'
                className='w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-600'
              >
                <svg
                  width='20'
                  height='20'
                  fill='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path d='M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.767.84 1.236 1.91 1.236 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.577z'></path>
                </svg>
              </a>
            </div> */}
          </div>
        </div>
      </footer>
    </main>
  );
}
