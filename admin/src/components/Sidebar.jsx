import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  ShoppingCart,
  Store,
  Image as ImageIcon,
  DollarSign,
  Crown,
  MessageSquare,
  Smartphone,
  BookOpen,
  Mail,
  QrCode,
  Scale,
} from 'lucide-react';

function Sidebar() {
  const location = useLocation();

  const navItems = [
    {
      name: 'Dashboard',
      path: '/',
      icon: LayoutDashboard,
    },
    {
      name: 'KYC Requests',
      path: '/kyc',
      icon: FileText,
    },
    {
      name: 'Users',
      path: '/users',
      icon: Users,
    },
    {
      name: 'Vendors',
      path: '/vendors',
      icon: Store,
    },
    {
      name: 'Products',
      path: '/products',
      icon: Package,
    },
    {
      name: 'TCE Store',
      path: '/tce-store',
      icon: Crown,
    },
    {
      name: 'Orders',
      path: '/orders',
      icon: ShoppingCart,
    },
    {
      name: 'Payouts',
      path: '/payouts',
      icon: DollarSign,
    },
    {
      name: 'Blog / Archive',
      path: '/blog',
      icon: BookOpen,
    },
    {
      name: 'QR Scans',
      path: '/qr-scans',
      icon: QrCode,
    },
    {
      name: 'Comparison Platforms',
      path: '/comparison-platforms',
      icon: Scale,
    },
    {
      name: 'Contact Messages',
      path: '/contact-messages',
      icon: Mail,
    },
    {
      name: 'Testimonials',
      path: '/testimonials',
      icon: MessageSquare,
    },
    {
      name: 'Phone Verification',
      path: '/phone-verifications',
      icon: Smartphone,
    },
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="w-64 bg-heritage-charcoal text-white flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-heritage-dark">
        <h2 className="text-xl font-serif font-bold text-luxury-gold">TCE ADMIN</h2>
        <p className="text-xs text-heritage-beige mt-1 tracking-wider">Management Portal</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`
                                        flex items-center gap-3 px-4 py-3 rounded-md transition-colors
                                        ${
                                          active
                                            ? 'bg-luxury-gold text-white'
                                            : 'text-heritage-beige hover:bg-heritage-dark'
                                        }
                                    `}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-heritage-dark">
        <p className="text-xs text-heritage-beige text-center">© 2026 The Collectors Exchange</p>
      </div>
    </aside>
  );
}

export default Sidebar;
