"use client"

import { useState, useEffect, useCallback } from "react"
import KioskTab1 from "@/app/ui/admin/kiosques/tab1"
import KioskTab2 from "@/app/ui/admin/kiosques/tab2"
import KioskTab3 from "@/app/ui/admin/kiosques/tab3"
import { AddKioskDialog } from "@/app/ui/admin/kiosques/nouveau"
import Header from "@/app/ui/header"
import { deleteKiosk, getKiosks, getKioskCounts } from "@/app/actions/kiosk-actions"

const tabs = [
  { id: "metrique", label: "Métriques" },
  { id: "dashboard", label: "Vue des kiosques sur Tableau" },
  { id: "invoices", label: "Vue des kiosques sur Carte" },
]

import { type Kiosk } from "@prisma/client"

// Interface pour les données formatées du serveur
interface DashboardData {
  totalKiosks: number
  kiosksAddedThisMonth: number
  percentageAddedThisMonth: number
  mono: {
    total: number
    inStock: number
    deployed: number
    occupied: number
    free: number
    maintenance: number
  }
  grand: {
    total: number
    inStock: number
    deployed: number
  }
  compartments: {
    total: number
    occupied: number
    free: number
    maintenance: number
  }
  totals: {
    totalCompartments: number
  }
  towns: {
    DOUALA: {
      MONO: { total: number; available: number; occupied: number; maintenance: number; inStock: number }
      GRAND: { 
        total: number
        available: number
        occupied: number
        maintenance: number
        inStock: number
        compartments: {
          available: number
          occupied: number
          maintenance: number
          total: number
        }
      }
    }
    YAOUNDE: {
      MONO: { total: number; available: number; occupied: number; maintenance: number; inStock: number }
      GRAND: { 
        total: number
        available: number
        occupied: number
        maintenance: number
        instock: number
        compartments: {
          available: number
          occupied: number
          maintenance: number
          total: number
        }
      }
    }
  }
}

export default function KioskManagement() {
  const [activeTab, setActiveTab] = useState("metrique")
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined)
  
  const [metricsData, setMetricsData] = useState<DashboardData | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)

  const fetchKiosks = useCallback(async () => {
    const result = await getKiosks({
      page: currentPage,
      searchTerm,
      status: filterStatus as any,
      date: filterDate,
    })
    setKiosks(result.kiosks)
    setTotalPages(result.totalPages)
  }, [currentPage, searchTerm, filterStatus, filterDate])

  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true)
    try {
      const result = await getKioskCounts()
      if (result && result.dashboard) {
        setMetricsData(result.dashboard)
      }
    } catch (error) {
      console.error("Error fetching metrics:", error)
    } finally {
      setMetricsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchKiosks()
  }, [fetchKiosks])

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 300000)
    return () => clearInterval(interval)
  }, [fetchMetrics])

  const handleSearch = (term: string) => {
    setSearchTerm(term)
    setCurrentPage(1)
  }

  const handleFilterStatus = (status: string) => {
    setFilterStatus(status)
    setCurrentPage(1)
  }

  const handleFilterDate = (date: Date | undefined) => {
    setFilterDate(date)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleKioskUpdate = (updatedKiosk: Kiosk) => {
    setKiosks(kiosks.map((kiosk) => (kiosk.id === updatedKiosk.id ? updatedKiosk : kiosk)))
    fetchMetrics()
  }

  const handleKioskDelete = async (kioskId: number) => {
    try {
      const result = await deleteKiosk(kioskId)
      if (result.error) {
        console.error(result.error)
      } else {
        setKiosks(kiosks.filter((kiosk) => kiosk.id !== kioskId))
        fetchMetrics()
      }
    } catch (error) {
      console.error("Error deleting kiosk:", error)
    }
  }

  const handleKioskAdd = (newKiosk: Kiosk) => {
    setKiosks((prevKiosks) => [newKiosk, ...prevKiosks])
    fetchKiosks()
    fetchMetrics()
  }

  const handleRefresh = () => {
    fetchKiosks()
    fetchMetrics()
  }

  return (
    <div className="container mx-auto p-4">
      <Header title="Kiosques" />
      <div className="flex justify-between items-center mb-6 mt-6">
        <nav className="flex space-x-1 border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 focus:outline-none ${
                activeTab === tab.id ? "border-b-2 border-orange-500 text-orange-600" : ""
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <AddKioskDialog 
          kiosks={kiosks} 
          onSuccess={(addedKiosk) => {
            handleKioskAdd(addedKiosk)
          }}
        />
      </div>

      <div className="mt-4">
        {activeTab === "metrique" && (
          <KioskTab1
            kiosks={kiosks}
            totalPages={totalPages}
            currentPage={currentPage}
            searchTerm={searchTerm}
            filterStatus={filterStatus}
            filterDate={filterDate}
            onSearch={handleSearch}
            onFilterStatus={handleFilterStatus}
            onFilterDate={handleFilterDate}
            onPageChange={handlePageChange}
            onKioskUpdate={handleKioskUpdate}
            onKioskDelete={handleKioskDelete}
            onRefresh={handleRefresh}
            metricsData={metricsData}
            metricsLoading={metricsLoading}
          />
        )}
        {activeTab === "dashboard" && (
          <KioskTab3
            kiosks={kiosks}
            totalPages={totalPages}
            currentPage={currentPage}
            searchTerm={searchTerm}
            filterStatus={filterStatus}
            filterDate={filterDate}
            onSearch={handleSearch}
            onFilterStatus={handleFilterStatus}
            onFilterDate={handleFilterDate}
            onPageChange={handlePageChange}
            onKioskUpdate={handleKioskUpdate}
            onKioskDelete={handleKioskDelete}
            onRefresh={handleRefresh}
          />
        )}
        {activeTab === "invoices" && <KioskTab2 />}
      </div>
    </div>
  )
}