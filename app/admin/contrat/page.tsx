"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlusIcon, FileTextIcon, EyeIcon, FileIcon } from "lucide-react"
import { getAllContractsStaff } from "@/app/actions/contractActions"
import type { ContractStatus } from "@prisma/client"

export default function ContractsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [contracts, setContracts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  const [filterStatus, setFilterStatus] = useState<string>("all") // Changé de "" à "all"

  useEffect(() => {
    const fetchContracts = async () => {
      setIsLoading(true)
      try {
        const filters: any = {}

        // Ne filtrer que si filterStatus n'est pas "all"
        if (filterStatus && filterStatus !== "all") {
          filters.status = filterStatus as ContractStatus
        }

        const result = await getAllContractsStaff(filters)

        if (result.success) {
          setContracts(result.contracts)
        } else {
          setError(result.error || "Failed to load contracts")
        }
      } catch (error) {
        console.error("Error fetching contracts:", error)
        setError("An error occurred while loading contracts")
      } finally {
        setIsLoading(false)
      }
    }

    if (session) {
      fetchContracts()
    }
  }, [session, filterStatus])

  const getStatusBadge = (status: ContractStatus) => {
    switch (status) {
      case "DRAFT":
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Brouillon</Badge>
      case "PENDING":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">En attente</Badge>
      case "CONFIRMED":
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Confirmé</Badge>
      case "ACTIVE":
        return <Badge className="bg-green-100 text-green-800">Actif</Badge>
      case "EXPIRED":
        return <Badge variant="destructive" className="bg-red-100 text-red-800">Expiré</Badge>
      case "TERMINATED":
        return <Badge variant="destructive" className="bg-red-100 text-red-800">Résilié</Badge>
      case "CANCELLED":
        return <Badge variant="destructive" className="bg-red-100 text-red-800">Annulé</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const filteredContracts = contracts.filter((contract) => {
    // Filtre par recherche
    const matchesSearch = 
      contract.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.contractNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Filtre par onglet
    let matchesTab = true
    if (activeTab === "active") {
      matchesTab = contract.status === "ACTIVE"
    } else if (activeTab === "pending") {
      matchesTab = ["DRAFT", "PENDING", "CONFIRMED"].includes(contract.status)
    } else if (activeTab === "expired") {
      matchesTab = ["EXPIRED", "TERMINATED", "CANCELLED"].includes(contract.status)
    }
    
    return matchesSearch && matchesTab
  })

  // Statistiques
  const stats = {
    total: contracts.length,
    active: contracts.filter((c) => c.status === "ACTIVE").length,
    pending: contracts.filter((c) => ["DRAFT", "PENDING", "CONFIRMED"].includes(c.status)).length,
    expired: contracts.filter((c) => ["EXPIRED", "TERMINATED", "CANCELLED"].includes(c.status)).length,
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Contrats</h1>
        <Button onClick={() => router.push("contrat/new")} className="bg-orange-500 hover:bg-orange-600 text-white">
          <PlusIcon className="mr-2 h-4 w-4" />
          Nouveau Contrat
        </Button>
      </div>

      {/* Statistiques Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Total Contrats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-green-50 to-green-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Contrats Actifs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{stats.active}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-yellow-50 to-yellow-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-700">En Attente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-red-50 to-red-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Expirés/Résiliés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{stats.expired}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-white shadow rounded-lg">
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <Input
            type="text"
            placeholder="Rechercher par client ou numéro de contrat"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-80"
          />
          <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value)}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="DRAFT">Brouillon</SelectItem>
              <SelectItem value="PENDING">En attente</SelectItem>
              <SelectItem value="CONFIRMED">Confirmé</SelectItem>
              <SelectItem value="ACTIVE">Actif</SelectItem>
              <SelectItem value="EXPIRED">Expiré</SelectItem>
              <SelectItem value="TERMINATED">Résilié</SelectItem>
              <SelectItem value="CANCELLED">Annulé</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">Tous ({stats.total})</TabsTrigger>
          <TabsTrigger value="active">Actifs ({stats.active})</TabsTrigger>
          <TabsTrigger value="pending">En attente ({stats.pending})</TabsTrigger>
          <TabsTrigger value="expired">Expirés/Résiliés ({stats.expired})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          <ContractsTable contracts={filteredContracts} getStatusBadge={getStatusBadge} />
        </TabsContent>
        <TabsContent value="active" className="mt-4">
          <ContractsTable contracts={filteredContracts} getStatusBadge={getStatusBadge} />
        </TabsContent>
        <TabsContent value="pending" className="mt-4">
          <ContractsTable contracts={filteredContracts} getStatusBadge={getStatusBadge} />
        </TabsContent>
        <TabsContent value="expired" className="mt-4">
          <ContractsTable contracts={filteredContracts} getStatusBadge={getStatusBadge} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ContractsTable({
  contracts,
  getStatusBadge,
}: {
  contracts: any[]
  getStatusBadge: (status: ContractStatus) => JSX.Element
}) {
  const router = useRouter()

  if (contracts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 bg-white rounded-lg shadow">
        <FileTextIcon className="h-12 w-12 mb-4" />
        <p className="text-lg">Aucun contrat trouvé</p>
        <p className="text-sm">Cliquez sur "Nouveau Contrat" pour en créer un</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="font-semibold">N° Contrat</TableHead>
            <TableHead className="font-semibold">Client</TableHead>
            <TableHead className="font-semibold">Date de création</TableHead>
            <TableHead className="font-semibold">Statut</TableHead>
            <TableHead className="font-semibold text-right">Montant total</TableHead>
            <TableHead className="font-semibold text-center">Kiosques</TableHead>
            <TableHead className="font-semibold text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.map((contract) => (
            <TableRow
              key={contract.id}
              className="cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => router.push(`contrat/${contract.id}`)}
            >
              <TableCell className="font-medium text-orange-600">{contract.contractNumber}</TableCell>
              <TableCell>{contract.clientName}</TableCell>
              <TableCell>{new Date(contract.createdAt).toLocaleDateString("fr-FR")}</TableCell>
              <TableCell>{getStatusBadge(contract.status)}</TableCell>
              <TableCell className="text-right font-semibold">
                {Number(contract.totalAmount).toLocaleString()} FCFA
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="bg-blue-50">
                  {contract.kiosks?.length || 0} kiosque(s)
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex justify-center space-x-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`contrat/${contract.id}`)
                    }}
                    className="border-orange-200 text-orange-600 hover:bg-orange-50"
                  >
                    <EyeIcon className="h-4 w-4 mr-1" />
                    Voir
                  </Button>
                  {contract.contractDocument && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.open(contract.contractDocument, "_blank")
                      }}
                      className="border-blue-200 text-blue-600 hover:bg-blue-50"
                    >
                      <FileIcon className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}