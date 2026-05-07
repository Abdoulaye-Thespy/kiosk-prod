"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { MoreHorizontal, RotateCcw, Filter, Eye, MapPin, Store, User, Phone, Tag, Package, Wrench, CheckCircle, LayoutGrid, Mail, Building2 } from "lucide-react"
import { UpdateKioskDialogAdmin } from "./modifykiok"
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

import { type Kiosk } from "@prisma/client"

interface KioskWithClient extends Kiosk {
  monoClient?: {
    id: string
    name: string
    email: string
    phone?: string
  } | null
  compartments?: any[]
}

interface KioskTab3Props {
  kiosks: KioskWithClient[]
  totalPages: number
  currentPage: number
  searchTerm: string
  filterStatus: string
  filterDate: Date | undefined
  onSearch: (term: string) => void
  onFilterStatus: (status: string) => void
  onFilterDate: (date: Date | undefined) => void
  onPageChange: (page: number) => void
  onKioskUpdate: (kiosk: Kiosk) => void
  onKioskDelete: (kioskId: number) => void
  onRefresh: () => void
}

// Mapping des catégories métier vers les statuts Prisma
const categoryToStatusMap: Record<string, string[]> = {
  "occupied": ["ACTIVE"],
  "free": ["AVAILABLE", "REQUEST", "LOCALIZING", "UNACTIVE"],
  "maintenance": ["ACTIVE_UNDER_MAINTENANCE", "UNACTIVE_UNDER_MAINTENANCE"],
  "instock": ["IN_STOCK"],
}

// Couleurs des badges par statut Prisma
const getStatusColor = (status: string) => {
  if (status === "ACTIVE") return "text-green-600 bg-green-50"
  if (status === "IN_STOCK") return "text-blue-600 bg-blue-50"
  if (["AVAILABLE", "REQUEST", "LOCALIZING", "UNACTIVE"].includes(status)) return "text-blue-600 bg-blue-50"
  if (["ACTIVE_UNDER_MAINTENANCE", "UNACTIVE_UNDER_MAINTENANCE"].includes(status)) return "text-yellow-600 bg-yellow-50"
  return "text-gray-600 bg-gray-50"
}

// Traduction des statuts Prisma pour l'affichage
const getStatusTranslation = (status: string, isGrand?: boolean, occupiedCount?: number, totalCompartments?: number) => {
  if (status === "ACTIVE") {
    if (isGrand && occupiedCount !== undefined && totalCompartments !== undefined) {
      return `🟢 Occupé (${occupiedCount}/${totalCompartments})`
    }
    return "🟢 Occupé"
  }
  if (status === "IN_STOCK") return "🏚️ En stock"
  if (["AVAILABLE", "REQUEST", "LOCALIZING", "UNACTIVE"].includes(status)) return "🔵 Libre"
  if (["ACTIVE_UNDER_MAINTENANCE", "UNACTIVE_UNDER_MAINTENANCE"].includes(status)) return "🟡 Maintenance"
  return status
}

// Traduction des types
const typeTranslations: Record<string, string> = {
  MONO: "MONO (1 compartiment)",
  GRAND: "GRAND (3 compartiments)",
}

// Traduction des villes
const townTranslations: Record<string, string> = {
  DOUALA: "Douala",
  YAOUNDE: "Yaoundé",
}

// Composant pour le dialogue de détails du kiosque
function KioskDetailsDialog({ kiosk, isOpen, onClose }: { kiosk: KioskWithClient | null; isOpen: boolean; onClose: () => void }) {
  if (!kiosk) return null

  const clientInfo = kiosk.monoClient
  // Sécuriser l'accès aux compartiments
  const compartments = Array.isArray(kiosk.compartments) ? kiosk.compartments : []
  
  // Calculer le nombre de compartiments occupés
  const occupiedCount = compartments.filter((c: any) => c?.status === "OCCUPIED").length
  const totalCompartments = compartments.length

  // Organiser les compartiments dans l'ordre LEFT, MIDDLE, RIGHT
  const orderedCompartments = [
    compartments.find((c: any) => c?.compartmentType === "LEFT"),
    compartments.find((c: any) => c?.compartmentType === "MIDDLE"),
    compartments.find((c: any) => c?.compartmentType === "RIGHT"),
  ].filter(Boolean)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Store className="h-5 w-5 text-orange-500" />
            Détails du kiosque
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-grow overflow-auto pr-4">
          {/* En-tête avec matricule et statut */}
          <div className="flex justify-between items-start mb-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Tag className="h-4 w-4 text-gray-500" />
                <span className="font-mono text-lg font-bold text-gray-800">{kiosk.kioskMatricule}</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">{kiosk.kioskName || "Sans nom"}</h3>
            </div>
            <Badge className={`${getStatusColor(kiosk.status)} text-sm px-3 py-1`}>
              {getStatusTranslation(kiosk.status)}
            </Badge>
          </div>

          {/* Informations générales */}
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-2 rounded-lg bg-white border">
              <Store className="h-5 w-5 text-orange-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-500">Type de kiosque</p>
                <p className="text-gray-800">{typeTranslations[kiosk.kioskType] || kiosk.kioskType}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2 rounded-lg bg-white border">
              <MapPin className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-500">Adresse</p>
                <p className="text-gray-800">{kiosk.kioskAddress || "Non renseignée"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2 rounded-lg bg-white border">
              <MapPin className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-500">Ville</p>
                <p className="text-gray-800">{townTranslations[kiosk.kioskTown] || kiosk.kioskTown}</p>
              </div>
            </div>

            {/* Coordonnées GPS */}
            {(kiosk.gpsLatitude || kiosk.gpsLongitude) && (
              <div className="flex items-start gap-3 p-2 rounded-lg bg-white border">
                <div className="h-5 w-5 mt-0.5">📍</div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Coordonnées GPS</p>
                  <p className="text-gray-800 font-mono text-sm">
                    {kiosk.gpsLatitude && `${kiosk.gpsLatitude}`}{kiosk.gpsLatitude && kiosk.gpsLongitude && " , "}{kiosk.gpsLongitude && `${kiosk.gpsLongitude}`}
                  </p>
                </div>
              </div>
            )}

            {/* Gestionnaire */}
            {(kiosk.managerName || kiosk.managerContacts) && (
              <div className="flex items-start gap-3 p-2 rounded-lg bg-white border">
                <User className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Gestionnaire</p>
                  <p className="text-gray-800">{kiosk.managerName || "Non renseigné"}</p>
                  {kiosk.managerContacts && (
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <Phone className="h-3 w-3" />
                      {kiosk.managerContacts}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Produits/Services */}
            {kiosk.productTypes && (
              <div className="flex items-start gap-3 p-2 rounded-lg bg-white border">
                <Package className="h-5 w-5 text-purple-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Produits / Services</p>
                  <p className="text-gray-800">{kiosk.productTypes}</p>
                </div>
              </div>
            )}

            {/* Informations sur le client (pour MONO) */}
            {kiosk.kioskType === "MONO" && (
              <div className="flex items-start gap-3 p-2 rounded-lg bg-white border">
                {clientInfo ? (
                  <>
                    <Building2 className="h-5 w-5 text-green-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-500">Client assigné</p>
                      <p className="text-gray-800 font-semibold">{clientInfo.name || "Nom non renseigné"}</p>
                      {clientInfo.email && (
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <Mail className="h-3 w-3" />
                          {clientInfo.email}
                        </p>
                      )}
                      {clientInfo.phone && (
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <Phone className="h-3 w-3" />
                          {clientInfo.phone}
                        </p>
                      )}
                      <p className="text-sm text-green-600 flex items-center gap-1 mt-2">
                        <CheckCircle className="h-3 w-3" />
                        Kiosque occupé par ce client
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Package className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Client assigné</p>
                      <p className="text-gray-500">Aucun client pour le moment</p>
                      <p className="text-sm text-blue-600 flex items-center gap-1 mt-1">
                        <Package className="h-3 w-3" />
                        Kiosque libre
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Compartiments (pour GRAND) - avec ordre LEFT, MIDDLE, RIGHT et design original */}
            {kiosk.kioskType === "GRAND" && compartments.length > 0 && (
              <div className="p-3 rounded-lg bg-white border">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4" />
                    Compartiments
                  </p>
                  <Badge className="bg-blue-100 text-blue-700">
                    {occupiedCount}/{totalCompartments} occupés
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {orderedCompartments.map((comp: any) => {
                    let statusIcon = null
                    let statusText = ""
                    let statusColor = ""
                    if (comp?.status === "OCCUPIED") {
                      statusIcon = <CheckCircle className="h-3 w-3 text-green-500" />
                      statusText = "Occupé"
                      statusColor = "bg-green-50"
                    } else if (comp?.status === "AVAILABLE") {
                      statusIcon = <Package className="h-3 w-3 text-blue-500" />
                      statusText = "Libre"
                      statusColor = "bg-blue-50"
                    } else if (comp?.status === "UNDER_MAINTENANCE") {
                      statusIcon = <Wrench className="h-3 w-3 text-yellow-500" />
                      statusText = "Maintenance"
                      statusColor = "bg-yellow-50"
                    }
                    return (
                      <div key={comp?.id || Math.random()} className={`text-center p-2 rounded-lg ${statusColor}`}>
                        <p className="text-xs font-medium text-gray-700">
                          {comp?.compartmentType === "LEFT" ? "Gauche" :
                           comp?.compartmentType === "MIDDLE" ? "Centre" :
                           comp?.compartmentType === "RIGHT" ? "Droit" : "Unique"}
                        </p>
                        <div className="flex items-center justify-center gap-1 mt-1">
                          {statusIcon}
                          <p className="text-xs text-gray-600">{statusText}</p>
                        </div>
                        {comp?.client && (
                          <div className="mt-1 text-xs text-gray-500 truncate" title={comp.client.name}>
                            {comp.client.name}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Informations de création */}
            <div className="flex items-start gap-3 p-2 rounded-lg bg-white border">
              <div className="h-5 w-5 mt-0.5">📅</div>
              <div>
                <p className="text-sm font-medium text-gray-500">Date de création</p>
                <p className="text-gray-800">{format(new Date(kiosk.createdAt), "dd/MM/yyyy HH:mm", { locale: fr })}</p>
              </div>
            </div>
          </div>
        </ScrollArea>
        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function KioskTab3({
  kiosks,
  totalPages,
  currentPage,
  searchTerm,
  filterStatus,
  filterDate,
  onSearch,
  onFilterStatus,
  onFilterDate,
  onPageChange,
  onKioskUpdate,
  onKioskDelete,
  onRefresh,
}: KioskTab3Props) {
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isModifyDialogOpen, setIsModifyDialogOpen] = useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [selectedKiosk, setSelectedKiosk] = useState<KioskWithClient | null>(null)
  
  // Filtres locaux
  const [localFilterType, setLocalFilterType] = useState<string>("all")
  const [localFilterCategory, setLocalFilterCategory] = useState<string>(filterStatus || "all")
  const [localSearchTerm, setLocalSearchTerm] = useState<string>(searchTerm || "")
  const [filteredKiosks, setFilteredKiosks] = useState<KioskWithClient[]>(kiosks)

  // Appliquer les filtres
  useEffect(() => {
    let filtered = [...kiosks]

    if (localFilterType !== "all") {
      filtered = filtered.filter(k => k.kioskType === localFilterType)
    }

    if (localFilterCategory !== "all") {
      const prismaStatuses = categoryToStatusMap[localFilterCategory] || []
      filtered = filtered.filter(k => prismaStatuses.includes(k.status))
    }

    if (localSearchTerm.trim()) {
      const term = localSearchTerm.toLowerCase()
      filtered = filtered.filter(k =>
        k.kioskMatricule?.toLowerCase().includes(term) ||
        k.kioskAddress?.toLowerCase().includes(term) ||
        k.managerName?.toLowerCase().includes(term) ||
        townTranslations[k.kioskTown]?.toLowerCase().includes(term)
      )
    }

    setFilteredKiosks(filtered)
  }, [kiosks, localFilterType, localFilterCategory, localSearchTerm])

  // Fonction pour calculer les compartiments occupés d'un kiosque GRAND
  const getOccupiedCount = (kiosk: KioskWithClient) => {
    if (kiosk.kioskType !== "GRAND") return null
    const compartments = Array.isArray(kiosk.compartments) ? kiosk.compartments : []
    const occupied = compartments.filter((c: any) => c?.status === "OCCUPIED").length
    const total = compartments.length
    return { occupied, total }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredKiosks.map((kiosk) => kiosk.id))
    } else {
      setSelectedIds([])
    }
  }

  const resetFilters = () => {
    setLocalFilterType("all")
    setLocalFilterCategory("all")
    setLocalSearchTerm("")
    onFilterStatus("")
    onFilterDate(undefined)
    onSearch("")
  }

  const applyFilters = () => {
    onPageChange(1)
    onRefresh()
    setIsFilterOpen(false)
  }

  const handleModify = (kiosk: KioskWithClient) => {
    setSelectedKiosk(kiosk)
    setIsModifyDialogOpen(true)
  }

  const handleViewDetails = (kiosk: KioskWithClient) => {
    setSelectedKiosk(kiosk)
    setIsDetailsDialogOpen(true)
  }

  const handleDelete = (kioskId: number) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce kiosque ?")) {
      onKioskDelete(kioskId)
    }
  }

  const handleKioskUpdate = (updatedKiosk: Kiosk) => {
    onKioskUpdate(updatedKiosk)
    onRefresh()
  }

  return (
    <div className="space-y-4 p-6">
      {/* Barre de filtres */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative w-72">
          <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par matricule, adresse, gestionnaire..."
            className="pl-8"
            value={localSearchTerm}
            onChange={(e) => setLocalSearchTerm(e.target.value)}
          />
        </div>

        <Select value={localFilterType} onValueChange={setLocalFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Type de kiosque" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="MONO">MONO</SelectItem>
            <SelectItem value="GRAND">GRAND</SelectItem>
          </SelectContent>
        </Select>

        <Select value={localFilterCategory} onValueChange={setLocalFilterCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="instock">🏚️ En stock</SelectItem>
            <SelectItem value="occupied">🟢 Occupés</SelectItem>
            <SelectItem value="free">🔵 Libres</SelectItem>
            <SelectItem value="maintenance">🟡 Maintenance</SelectItem>
          </SelectContent>
        </Select>

        {(localFilterType !== "all" || localFilterCategory !== "all" || localSearchTerm) && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="text-red-500">
            Effacer les filtres
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={onRefresh}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <h3 className="font-medium text-lg">Filtres avancés</h3>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Statut</label>
                  <Select value={localFilterCategory} onValueChange={setLocalFilterCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner le statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="instock">🏚️ En stock</SelectItem>
                      <SelectItem value="occupied">🟢 Occupés</SelectItem>
                      <SelectItem value="free">🔵 Libres</SelectItem>
                      <SelectItem value="maintenance">🟡 Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date de création</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        {filterDate ? format(filterDate, "P", { locale: fr }) : "Sélectionner la date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={filterDate} onSelect={onFilterDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={resetFilters}>
                    Réinitialiser
                  </Button>
                  <Button onClick={applyFilters}>Appliquer</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Tableau des kiosques */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox 
                  checked={selectedIds.length === filteredKiosks.length && filteredKiosks.length > 0} 
                  onCheckedChange={handleSelectAll} 
                />
              </TableHead>
              <TableHead>Matricule</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Adresse</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Gestionnaire</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredKiosks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                  Aucun kiosque ne correspond aux critères
                </TableCell>
              </TableRow>
            ) : (
              filteredKiosks.map((kiosk) => {
                const occupiedInfo = getOccupiedCount(kiosk)
                const isGrand = kiosk.kioskType === "GRAND"
                const displayStatus = getStatusTranslation(
                  kiosk.status, 
                  isGrand, 
                  occupiedInfo?.occupied, 
                  occupiedInfo?.total
                )
                
                return (
                  <TableRow key={kiosk.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(kiosk.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIds([...selectedIds, kiosk.id])
                          } else {
                            setSelectedIds(selectedIds.filter((id) => id !== kiosk.id))
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="link"
                        className="font-mono text-sm p-0 h-auto font-semibold text-orange-600 hover:text-orange-800"
                        onClick={() => handleViewDetails(kiosk)}
                      >
                        {kiosk.kioskMatricule}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        kiosk.kioskType === "MONO" ? "bg-orange-100 text-orange-700" : "bg-purple-100 text-purple-700"
                      }`}>
                        {typeTranslations[kiosk.kioskType] || kiosk.kioskType}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate">{kiosk.kioskAddress || "-"}</TableCell>
                    <TableCell>{townTranslations[kiosk.kioskTown] || kiosk.kioskTown}</TableCell>
                    <TableCell>{kiosk.managerName || "-"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(kiosk.status)}`}>
                        {displayStatus}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleViewDetails(kiosk)}
                          title="Voir les détails"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent side="left" className="w-32">
                            <div className="flex flex-col space-y-1">
                              <Button size="sm" variant="ghost" className="justify-start" onClick={() => handleModify(kiosk)}>
                                Modifier
                              </Button>
                              <Button size="sm" variant="ghost" className="justify-start text-red-600" onClick={() => handleDelete(kiosk.id)}>
                                Supprimer
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Page {currentPage} sur {totalPages} - {filteredKiosks.length} kiosque(s)
        </p>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            Précédent
          </Button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(page)}
              className={`${currentPage === page ? "bg-orange-500 text-white hover:bg-orange-600" : ""}`}
            >
              {page}
            </Button>
          ))}
          {totalPages > 5 && <span className="flex items-center px-2">...</span>}
          {totalPages > 5 && (
            <Button
              variant={currentPage === totalPages ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(totalPages)}
              className={currentPage === totalPages ? "bg-orange-500 text-white hover:bg-orange-600" : ""}
            >
              {totalPages}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            Suivant
          </Button>
        </div>
      </div>

      {/* Dialogue de détails */}
      <KioskDetailsDialog
        kiosk={selectedKiosk}
        isOpen={isDetailsDialogOpen}
        onClose={() => setIsDetailsDialogOpen(false)}
      />

      {/* Dialogue de modification */}
      <UpdateKioskDialogAdmin
        isOpen={isModifyDialogOpen}
        kiosks={kiosks}
        onOpenChange={setIsModifyDialogOpen}
        kiosk={selectedKiosk}
        onSuccess={(updatedKiosk) => {
          setIsModifyDialogOpen(false)
          handleKioskUpdate(updatedKiosk)
        }}
      />
    </div>
  )
}