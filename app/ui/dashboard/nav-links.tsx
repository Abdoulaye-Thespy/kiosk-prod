'use client';

import {
  UserGroupIcon,
  HomeIcon,
  ChartPieIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  ClipboardDocumentIcon,
  ClipboardIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import Link from 'next/link';

// Map of links to display in the side navigation.
// Depending on the size of the application, this would be stored in a database.
const linksAdmin = [
  { name: 'Tableau de bord', href: '/admin', icon: HomeIcon },
  {
    name: 'Utilisateurs',
    href: '/admin/utilisateurs',
    icon: UserGroupIcon,
  },
  // { name: 'Rapports', 
  //   href: '/admin/rapports', 
  //   icon: ChartPieIcon 
  // },
  { name: 'Kiosques', href: '/admin/kiosques', icon: BuildingOfficeIcon },
  { name: 'Contrats', href: '/admin/contrat', icon: ClipboardIcon },
  { name: 'Proforma', 
    href: '/admin/proforma', 
    icon: ChartPieIcon 
  },
  { name: 'Factures & Paiments', href: '/admin/facturepaiement', icon: ClipboardDocumentIcon },
  { name: 'Administration des Ventes', href: '/admin/administrationvente', icon: ClipboardDocumentIcon },
  { name: 'Maintenances', href: '/admin/maintenances', icon: QuestionMarkCircleIcon },
  { name: 'Paramètres', href: '/admin/parametres', icon: Cog6ToothIcon },
];

const linksCommercial = [
  { name: 'Gestion des Prospect', href: '/commercial', icon: HomeIcon },
  {
    name: 'proforma',
    href: '/commercial/proforma',
    icon: UserGroupIcon,
  },
  { name: 'Contrats', 
    href: '/commercial/contrat', 
    icon: ChartPieIcon 
  },
  { name: 'Factures & Paiements', href: '/commercial/facture', icon: QuestionMarkCircleIcon },
  { name: 'Rapports de vente', href: '/commercial/rapport', icon: QuestionMarkCircleIcon },
  { name: 'Paramètres', href: '/commercial/parametres', icon: Cog6ToothIcon },
];

const linksClient = [
  { name: 'Mes kiosques', href: '/client', icon: HomeIcon },
  // {
  //   name: 'Mes Contrats',
  //   href: '/client/contrats',
  //   icon: UserGroupIcon,
  // },
  // {
  //   name: 'Mes Factures',
  //   href: '/client/factures',
  //   icon: UserGroupIcon,
  // },
  { name: 'SAV', 
    href: '/client/SAV', 
    icon: ChartPieIcon 
  },
  { name: 'Paramètres', href: '/client/parametre', icon: QuestionMarkCircleIcon },
];

const linksComptable = [
  { name: 'Facturation', href: '/comptable', icon: HomeIcon },
  {
    name: 'Paiements',
    href: '/comptable/paiement',
    icon: UserGroupIcon,
  },
  { name: 'Recouvrement', 
    href: '/comptable/recouvrement', 
    icon: ChartPieIcon 
  },
  { name: 'Rapports financiers', 
    href: '/comptable/rapports', 
    icon: ChartPieIcon 
  },
  { name: 'Paramètres', href: '/comptable/parametre', icon: QuestionMarkCircleIcon },
];

const linksTechnicien = [
  { name: 'Kiosques', href: '/technicien', icon: HomeIcon },
  {
    name: 'Mes Tâches',
    href: '/technicien/taches',
    icon: UserGroupIcon,
  },
  { name: 'documentation', 
    href: '/technicien/documentation', 
    icon: ChartPieIcon 
  },
  { name: 'Paramètres', href: '/technicien/parametre', icon: QuestionMarkCircleIcon },
];

const linksResponsable = [
  { name: 'Tableau de bord', href: '/responsable', icon: HomeIcon },
  {
    name: 'Gestion des kiosques',
    href: '/responsable/gestion',
    icon: UserGroupIcon,
  },
  { name: 'Interventions', 
    href: '/responsable/interventions',
    icon: ChartPieIcon 
  },
  // { name: 'Inventaires', 
  //   href: '/responsable/inventaires', 
  //   icon: ChartPieIcon 
  // },
  // { name: 'Rapports d’activités', 
  //   href: '/responsable/rapports', 
  //   icon: ChartPieIcon 
  // },
  { name: 'Paramètres', href: '/responsable/parametre', icon: QuestionMarkCircleIcon },
];
const linksJuridique = [
  { name: 'Contrat', href: '/juridique', icon: HomeIcon },
  {
    name: 'Contrat à valider',
    href: '/juridique/validation',
    icon: UserGroupIcon,
  },
  { name: 'Paramètres', 
    href: '/responsable/parametre', 
    icon: QuestionMarkCircleIcon },
];
export default function NavLinks({ userRole = 'client' }: { userRole?: 'admin' | 'commercial' | 'client' | 'technicien' | 'comptable'| 'responsable' | 'juridique' }) {
  const pathname = usePathname();
  
  let links = linksClient;

  if (userRole === 'admin') {
    links = linksAdmin;
  } else if (userRole === 'commercial') {
    links = linksCommercial;
  } else if (userRole === 'technicien') {
    links = linksTechnicien;
  } else if (userRole === 'comptable') {
    links = linksComptable;
  } else if (userRole === 'responsable') {
    links = linksResponsable;
  } else if (userRole === 'juridique') {
    links = linksJuridique;
  }

  return (
    <>
      {links.map((link) => {
        const LinkIcon = link.icon;
        return (
          <Link
            key={link.name}
            href={link.href}
            className={clsx(
              'flex h-[48px] grow items-center justify-center gap-1 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-sky-100 hover:text-blue-600 md:flex-none md:justify-start md:p-2 md:px-3',
              {
                'bg-sky-100 text-[#E55210]': pathname === link.href,
              },
            )}
          >
            <LinkIcon className="w-6" />
            <p className="hidden md:block">{link.name}</p>
          </Link>
        );
      })}
    </>
  );
}