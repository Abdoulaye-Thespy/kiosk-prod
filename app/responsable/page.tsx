"use client"

import { useState, useEffect, useCallback } from "react"
import KioskTab1 from "@/app/ui/admin/kiosques/tab1"
import KioskTab2 from "@/app/ui/admin/kiosques/tab2"
import KioskTab3 from "@/app/ui/admin/kiosques/tab3"
import { AddKioskDialog } from "@/app/ui/admin/kiosques/nouveau"
import Header from "@/app/ui/header"
import { deleteKiosk, getKiosks } from "@/app/actions/kiosk-actions"

const tabs = [
  { id: "metrique", label: "Metriques" },
  { id: "dashboard", label: "Vue des kiosque sur Tabeau" },
  { id: "invoices", label: "Vue des kiosque sur Carte" },
]


import { type Kiosk } from "@prisma/client"

export default function InvoiceDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined)

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

  useEffect(() => {
    fetchKiosks()
  }, [fetchKiosks])

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
  }

  const handleKioskDelete = async (kioskId: number) => {
      try {
        const result = await deleteKiosk(kioskId)
        if (result.error) {
          // You might want to add a toast notification here
          console.error(result.error)
        } else {
          // Update local state only after successful deletion
          setKiosks(kiosks.filter((kiosk) => kiosk.id !== kioskId))
          // You might want to add a success toast notification here
          console.log(result.message)
        }
      } catch (error) {
        console.error("Error deleting kiosk:", error)
      }
  }

  const handleKioskAdd = (newKiosk: Kiosk) => {
    setKiosks((prevKiosks) => [newKiosk, ...prevKiosks])
    fetchKiosks() // Refresh the list to ensure we have the latest data
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
        <AddKioskDialog kiosks={kiosks} 
        onSuccess={(addedKiosk) => {
          handleKioskAdd(addedKiosk)
        }}
        />
      </div>

      <div className="mt-4">
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
            onRefresh={fetchKiosks}
          />
        )}
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
            onRefresh={fetchKiosks}
          />
        )}
        {activeTab === "invoices" && <KioskTab2 />}
      </div>
    </div>
  )
}

