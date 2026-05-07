"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, CheckCircle2, XCircle, UserRound, RefreshCw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { updateKiosk } from "@/app/actions/kiosk-actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Search } from "lucide-react"
import { fetchClients } from "@/app/actions/fetchUserStats"
import { Badge } from "@/components/ui/badge"

interface Client {
  id: string
  name: string
  email: string
  phone?: string
}

interface CompartmentData {
  id?: number
  compartmentType: string
  status: string
  clientId?: string | null
  clientName?: string
  clientEmail?: string
  clientPhone?: string
  customName?: string
  monthlyRevenue?: number
  notes?: string
}

interface KioskWithClient {
  id: number
  kioskName: string
  kioskMatricule: string
  kioskType: string
  kioskAddress?: string
  gpsLatitude?: number | null
  gpsLongitude?: number | null
  kioskTown?: string
  productTypes?: string
  managerName?: string
  managerContacts?: string
  status: string
  userId?: string
  clientName?: string
  monoClientId?: string | null
  monoClient?: {
    name: string
    email: string
    phone?: string
  } | null
  compartments?: CompartmentData[]
  createdAt?: string
  updatedAt?: string
}

interface UpdateKioskDialogAdminProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  kiosk: KioskWithClient | null
  kiosks: KioskWithClient[]
  onSuccess: (updatedKiosk: any) => void
}

// Mapping des catégories vers les statuts Prisma
const categoryStatusMap: Record<string, string[]> = {
  "🏚️ EN STOCK": ["IN_STOCK"],
  "🟢 OCCUPÉ": ["ACTIVE"],
  "🔵 LIBRE": ["AVAILABLE", "REQUEST", "LOCALIZING", "UNACTIVE"],
  "🟡 MAINTENANCE": ["ACTIVE_UNDER_MAINTENANCE", "UNACTIVE_UNDER_MAINTENANCE"],
}

// Mapping inverse : statut Prisma -> catégorie
const getCategoryFromStatus = (status: string): string => {
  if (status === "IN_STOCK") return "🏚️ EN STOCK"
  if (status === "ACTIVE") return "🟢 OCCUPÉ"
  if (["AVAILABLE", "REQUEST", "LOCALIZING", "UNACTIVE"].includes(status)) return "🔵 LIBRE"
  if (["ACTIVE_UNDER_MAINTENANCE", "UNACTIVE_UNDER_MAINTENANCE"].includes(status)) return "🟡 MAINTENANCE"
  return "🏚️ EN STOCK"
}

// Liste des catégories pour le select (seulement pour MONO)
const categories = [
  { label: "🏚️ EN STOCK", value: "IN_STOCK", default: true },
  { label: "🟢 OCCUPÉ", value: "ACTIVE", default: false },
  { label: "🔵 LIBRE", value: "AVAILABLE", default: false },
  { label: "🟡 MAINTENANCE", value: "ACTIVE_UNDER_MAINTENANCE", default: false },
]

// Liste des villes pour le select
const towns = [
  { label: "Douala", value: "DOUALA" },
  { label: "Yaoundé", value: "YAOUNDE" },
]

// Statuts possibles pour les compartiments
const compartmentStatuses = [
  { label: "🔵 Libre", value: "AVAILABLE" },
  { label: "🟢 Occupé", value: "OCCUPIED" },
  { label: "🟡 Maintenance", value: "UNDER_MAINTENANCE" },
]

export function UpdateKioskDialogAdmin({
  isOpen,
  onOpenChange,
  kiosk,
  kiosks,
  onSuccess,
}: UpdateKioskDialogAdminProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pendingCategoryChange, setPendingCategoryChange] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmMessage, setConfirmMessage] = useState("")

  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [selectedClientName, setSelectedClientName] = useState<string>("")
  const [openClientSelect, setOpenClientSelect] = useState(false)
  const [isLoadingClients, setIsLoadingClients] = useState(true)
  const [clientsLoaded, setClientsLoaded] = useState(false)
  const [showClientSelector, setShowClientSelector] = useState(false)

  // États pour la sélection de client par compartiment
  const [openLeftClientSelect, setOpenLeftClientSelect] = useState(false)
  const [openMiddleClientSelect, setOpenMiddleClientSelect] = useState(false)
  const [openRightClientSelect, setOpenRightClientSelect] = useState(false)

  const [initialClientId, setInitialClientId] = useState<string>("")
  const [initialClientName, setInitialClientName] = useState<string>("")

  const [formData, setFormData] = useState<Partial<KioskWithClient>>({
    kioskName: "",
    clientName: "",
    kioskAddress: "",
    gpsLatitude: null,
    gpsLongitude: null,
    kioskType: "",
    managerName: "",
    managerContacts: "",
    productTypes: "",
    userId: "",
    status: "IN_STOCK",
    kioskTown: "DOUALA",
    compartments: [],
  })

  const [selectedCategory, setSelectedCategory] = useState<string>("🏚️ EN STOCK")

  // Charger les clients
  useEffect(() => {
    const getClients = async () => {
      if (clientsLoaded) return
      
      setIsLoadingClients(true)
      try {
        const data = await fetchClients()
        setClients(data.clients || [])
        setClientsLoaded(true)
      } catch (error) {
        console.error("Error fetching clients:", error)
        setClients([])
      } finally {
        setIsLoadingClients(false)
      }
    }

    if (isOpen) {
      getClients()
    }
  }, [isOpen, clientsLoaded])

  // Charger les données du kiosque
  useEffect(() => {
    if (kiosk) {
      const clientId = kiosk.monoClientId || kiosk.userId || ""
      const clientName = kiosk.monoClient?.name || kiosk.clientName || ""
      
      // Initialiser les données des compartiments pour les kiosques GRAND
      let compartmentsData = []
      if (kiosk.kioskType === "GRAND" && (kiosk as any).compartments) {
        const comps = (kiosk as any).compartments
        compartmentsData = comps.map((comp: any) => ({
          id: comp.id,
          compartmentType: comp.compartmentType,
          status: comp.status,
          clientId: comp.clientId,
          clientName: comp.client?.name,
          clientEmail: comp.client?.email,
          clientPhone: comp.client?.phone,
          customName: comp.customName,
          monthlyRevenue: comp.monthlyRevenue,
          notes: comp.notes,
        }))
      }
      
      setFormData({
        ...kiosk,
        userId: clientId,
        clientName: clientName,
        compartments: compartmentsData,
      })
      setSelectedClientId(clientId)
      setSelectedClientName(clientName)
      setInitialClientId(clientId)
      setInitialClientName(clientName)
      setSelectedCategory(getCategoryFromStatus(kiosk.status || "IN_STOCK"))
      setShowClientSelector(false)
    } else {
      setFormData({
        kioskName: "",
        clientName: "",
        kioskAddress: "",
        gpsLatitude: null,
        gpsLongitude: null,
        kioskType: "",
        managerName: "",
        managerContacts: "",
        productTypes: "",
        userId: "",
        status: "IN_STOCK",
        kioskTown: "DOUALA",
        compartments: [],
      })
      setSelectedClientId("")
      setSelectedClientName("")
      setInitialClientId("")
      setInitialClientName("")
      setSelectedCategory("🏚️ EN STOCK")
      setShowClientSelector(false)
    }
  }, [kiosk])

  // Mettre à jour le nom du client quand la liste des clients est chargée
  useEffect(() => {
    if (selectedClientId && clients.length > 0 && !selectedClientName) {
      const foundClient = clients.find(c => c.id === selectedClientId)
      if (foundClient) {
        setSelectedClientName(foundClient.name)
        if (initialClientId === selectedClientId) {
          setInitialClientName(foundClient.name)
        }
        setFormData(prev => ({
          ...prev,
          clientName: foundClient.name,
        }))
      }
    }
  }, [clients, selectedClientId, selectedClientName, initialClientId])

  // Calculer le nombre de compartiments occupés
  const getOccupiedCompartmentsCount = () => {
    if (!formData.compartments) return 0
    return formData.compartments.filter(c => c.status === "OCCUPIED").length
  }

  const handleCategoryChange = (categoryLabel: string) => {
    const oldCategory = selectedCategory
    const newCategory = categoryLabel
    
    const wasOccupied = oldCategory === "🟢 OCCUPÉ"
    const willBeFree = newCategory === "🔵 LIBRE"
    const willBeStock = newCategory === "🏚️ EN STOCK"
    const willBeMaintenance = newCategory === "🟡 MAINTENANCE"
    
    let needsConfirmation = false
    let message = ""
    
    if (wasOccupied && willBeFree) {
      needsConfirmation = true
      message = "⚠️ Attention : Passer ce kiosque de « Occupé » à « Libre » supprimera toutes les informations du client (nom, email, téléphone, produits/services, gestionnaire). Êtes-vous sûr de vouloir continuer ?"
    } else if (wasOccupied && willBeStock) {
      needsConfirmation = true
      message = "⚠️ Attention : Passer ce kiosque de « Occupé » à « En stock » supprimera toutes les informations du client et le retirera du terrain. Êtes-vous sûr de vouloir continuer ?"
    } else if (wasOccupied && willBeMaintenance) {
      needsConfirmation = true
      message = "⚠️ Attention : Passer ce kiosque de « Occupé » à « Maintenance » signifie que le kiosque a un problème technique. Le client reste associé mais le kiosque n'est plus actif. Confirmez-vous ?"
    }
    
    if (needsConfirmation) {
      setPendingCategoryChange(categoryLabel)
      setConfirmMessage(message)
      setShowConfirmDialog(true)
    } else {
      applyCategoryChange(categoryLabel)
    }
  }
  
  const applyCategoryChange = (categoryLabel: string) => {
    setSelectedCategory(categoryLabel)
    const prismaStatuses = categoryStatusMap[categoryLabel]
    if (prismaStatuses && prismaStatuses.length > 0) {
      setFormData({ ...formData, status: prismaStatuses[0] })
    }
    
    if (categoryLabel === "🔵 LIBRE" || categoryLabel === "🏚️ EN STOCK") {
      setSelectedClientId("")
      setSelectedClientName("")
      setFormData(prev => ({
        ...prev,
        userId: "",
        clientName: "",
        productTypes: "",
        managerName: "",
        managerContacts: "",
      }))
      setShowClientSelector(false)
    }
    
    setPendingCategoryChange(null)
    setShowConfirmDialog(false)
  }
  
  const cancelCategoryChange = () => {
    setPendingCategoryChange(null)
    setShowConfirmDialog(false)
  }

  // Mettre à jour le statut d'un compartiment
  const updateCompartmentStatus = (compartmentType: string, status: string) => {
    setFormData(prev => ({
      ...prev,
      compartments: (prev.compartments || []).map(comp =>
        comp.compartmentType === compartmentType
          ? { ...comp, status, clientId: null, clientName: undefined, clientEmail: undefined, clientPhone: undefined }
          : comp
      ),
    }))
  }

  // Mettre à jour le client d'un compartiment avec toutes ses informations
  const updateCompartmentClient = (compartmentType: string, client: Client) => {
    setFormData(prev => ({
      ...prev,
      compartments: (prev.compartments || []).map(comp =>
        comp.compartmentType === compartmentType
          ? { 
              ...comp, 
              clientId: client.id, 
              clientName: client.name,
              clientEmail: client.email,
              clientPhone: client.phone,
              status: "OCCUPIED" 
            }
          : comp
      ),
    }))
  }

  // Obtenir les données d'un compartiment par son type
  const getCompartmentData = (compartmentType: string) => {
    return (formData.compartments || []).find(comp => comp.compartmentType === compartmentType)
  }

  // Mettre à jour les informations additionnelles d'un compartiment
  const updateCompartmentInfo = (compartmentType: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      compartments: (prev.compartments || []).map(comp =>
        comp.compartmentType === compartmentType
          ? { ...comp, [field]: value }
          : comp
      ),
    }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    let prismaStatus = formData.status

    // Pour les kiosques MONO, on garde la logique existante
    if (formData.kioskType === "MONO") {
      if (selectedCategory) {
        const statuses = categoryStatusMap[selectedCategory]
        if (statuses && statuses.length > 0) {
          prismaStatus = statuses[0]
        }
      }

      const isMonoWithClient = formData.kioskType === "MONO" && selectedClientId
      if (isMonoWithClient) {
        prismaStatus = "ACTIVE"
      }

      const isMonoWithoutClient = formData.kioskType === "MONO" && !selectedClientId
      if (isMonoWithoutClient) {
        const hasGpsCoordinates = formData.gpsLatitude && formData.gpsLongitude
        prismaStatus = hasGpsCoordinates ? "UNACTIVE" : "AVAILABLE"
      }
    } else {
      // Pour les kiosques GRAND, le statut dépend des compartiments
      const occupiedCount = getOccupiedCompartmentsCount()
      if (occupiedCount === 0) {
        prismaStatus = "AVAILABLE"
      } else {
        prismaStatus = "ACTIVE"
      }
    }

    // Préparer les données des compartiments pour l'envoi
    const compartmentsData = formData.kioskType === "GRAND" && formData.compartments
      ? {
          left: (formData.compartments.find(c => c.compartmentType === "LEFT")),
          middle: (formData.compartments.find(c => c.compartmentType === "MIDDLE")),
          right: (formData.compartments.find(c => c.compartmentType === "RIGHT")),
        }
      : null

    const updatedData = {
      ...formData,
      userId: selectedClientId,
      clientName: selectedClientName,
      status: prismaStatus,
      compartments: compartmentsData,
    }

    try {
      const result = await updateKiosk(kiosk!.id, updatedData as any)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess("Le kiosque a été modifié avec succès.")
        const updatedKiosk = { ...kiosk, ...updatedData }
        onSuccess(updatedKiosk)
        setTimeout(() => {
          onOpenChange(false)
        }, 2000)
      }
    } catch (err) {
      setError("Une erreur est survenue lors de la modification du kiosque.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasClient = !!kiosk?.monoClientId
  const occupiedCount = getOccupiedCompartmentsCount()
  const isGrandKiosk = formData.kioskType === "GRAND"

  const handleChangeClient = () => {
    setShowClientSelector(true)
  }

  const handleCancelChangeClient = () => {
    setShowClientSelector(false)
    setSelectedClientId(initialClientId)
    setSelectedClientName(initialClientName)
    setFormData(prev => ({
      ...prev,
      userId: initialClientId,
      clientName: initialClientName,
    }))
  }

  // Composant pour la sélection de client par compartiment
  const ClientSelector = ({ 
    compartmentType, 
    open, 
    setOpen, 
    currentClientName,
    onSelect 
  }: { 
    compartmentType: string
    open: boolean
    setOpen: (open: boolean) => void
    currentClientName?: string
    onSelect: (client: Client) => void
  }) => (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between mt-2">
          {currentClientName || "Sélectionner un client"}
          <Search className="ml-2 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Rechercher un client..." />
          <CommandList>
            <CommandEmpty>Aucun client trouvé.</CommandEmpty>
            <CommandGroup>
              {clients.map((client) => (
                <CommandItem
                  key={client.id}
                  onSelect={() => {
                    onSelect(client)
                    setOpen(false)
                  }}
                >
                  {client.name} ({client.email})
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )

  // Composant pour les informations d'un compartiment occupé
  const OccupantInfoForm = ({ compartment, onUpdate }: { compartment: CompartmentData; onUpdate: (field: string, value: any) => void }) => (
    <div className="mt-3 space-y-2 pt-2 border-t border-gray-100">
      <p className="text-xs font-medium text-gray-500">Informations de l'occupant</p>
      <div>
        <Label className="text-xs">Nom du client</Label>
        <Input
          type="text"
          value={compartment.clientName || ""}
          onChange={(e) => onUpdate("clientName", e.target.value)}
          className="text-sm mt-1"
          placeholder="Nom du client"
        />
      </div>
      <div>
        <Label className="text-xs">Email</Label>
        <Input
          type="email"
          value={compartment.clientEmail || ""}
          onChange={(e) => onUpdate("clientEmail", e.target.value)}
          className="text-sm mt-1"
          placeholder="Email du client"
        />
      </div>
      <div>
        <Label className="text-xs">Téléphone</Label>
        <Input
          type="tel"
          value={compartment.clientPhone || ""}
          onChange={(e) => onUpdate("clientPhone", e.target.value)}
          className="text-sm mt-1"
          placeholder="Téléphone du client"
        />
      </div>
      <div>
        <Label className="text-xs">Revenu mensuel (CFA)</Label>
        <Input
          type="number"
          value={compartment.monthlyRevenue || ""}
          onChange={(e) => onUpdate("monthlyRevenue", e.target.value ? Number(e.target.value) : undefined)}
          className="text-sm mt-1"
          placeholder="Revenu mensuel"
        />
      </div>
      <div>
        <Label className="text-xs">Notes</Label>
        <Input
          type="text"
          value={compartment.notes || ""}
          onChange={(e) => onUpdate("notes", e.target.value)}
          className="text-sm mt-1"
          placeholder="Notes supplémentaires"
        />
      </div>
    </div>
  )

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-xl font-semibold">
              {isGrandKiosk ? "Gérer les compartiments" : "Modifier le kiosque"}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-grow overflow-auto">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Erreur</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert variant="default" className="mb-4 bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Succès</AlertTitle>
                <AlertDescription className="text-green-700">{success}</AlertDescription>
              </Alert>
            )}
            <form id="kiosk-form" onSubmit={handleSubmit} className="space-y-3 pr-4">
              {/* Pour les kiosques MONO, afficher les champs normaux */}
              {!isGrandKiosk && (
                <>
                  <div>
                    <Label htmlFor="kiosk-name">Nom de l'Entreprise</Label>
                    <Input
                      id="kiosk-name"
                      type="text"
                      placeholder="Nom du kiosque"
                      value={formData.kioskName || ""}
                      onChange={(e) => setFormData({ ...formData, kioskName: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="kiosk-matricule">Matricule</Label>
                    <Input
                      id="kiosk-matricule"
                      type="text"
                      value={formData.kioskMatricule || ""}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>

                  <div>
                    <Label htmlFor="kiosk-status">Statut du kiosque</Label>
                    <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue placeholder="Sélectionnez le statut" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.label} value={category.label}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="kiosk-town">Ville</Label>
                    <Select
                      value={formData.kioskTown || "DOUALA"}
                      onValueChange={(value) => setFormData({ ...formData, kioskTown: value })}
                    >
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue placeholder="Sélectionnez la ville" />
                      </SelectTrigger>
                      <SelectContent>
                        {towns.map((town) => (
                          <SelectItem key={town.value} value={town.value}>
                            {town.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Sélection client pour MONO */}
                  {(hasClient || selectedClientId) && !showClientSelector && selectedClientName ? (
                    <div>
                      <Label>Client du kiosque</Label>
                      <div className="flex items-center gap-2 mt-1 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <UserRound className="h-5 w-5 text-green-600" />
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">{selectedClientName}</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleChangeClient}
                          className="text-orange-500 border-orange-300 hover:bg-orange-50"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Changer
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="client-select">
                        Client du kiosque
                        {!selectedClientId && (
                          <span className="ml-2 text-xs text-blue-500 font-normal">(Aucun client - Kiosque libre)</span>
                        )}
                      </Label>

                      <Popover open={openClientSelect} onOpenChange={setOpenClientSelect}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-between mt-1">
                            {selectedClientId && selectedClientName
                              ? selectedClientName
                              : "🔵 Aucun client (kiosque libre)"}
                            <Search className="ml-2 h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                          <Command>
                            <CommandInput placeholder="Rechercher un client..." />
                            <CommandList>
                              <CommandEmpty>
                                {isLoadingClients ? "Chargement des clients..." : "Aucun client trouvé."}
                              </CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  onSelect={() => {
                                    setSelectedClientId("")
                                    setSelectedClientName("")
                                    setOpenClientSelect(false)
                                    setFormData({
                                      ...formData,
                                      userId: "",
                                      clientName: "",
                                    })
                                  }}
                                  className="text-blue-600"
                                >
                                  🔵 Aucun client (kiosque libre)
                                </CommandItem>
                                {clients.map((client) => (
                                  <CommandItem
                                    key={client.id}
                                    onSelect={() => {
                                      setSelectedClientId(client.id)
                                      setSelectedClientName(client.name)
                                      setOpenClientSelect(false)
                                      setFormData({
                                        ...formData,
                                        userId: client.id,
                                        clientName: client.name,
                                      })
                                    }}
                                  >
                                    {client.name} ({client.email})
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="kiosk-address">Adresse du kiosque</Label>
                    <Input
                      id="kiosk-address"
                      type="text"
                      placeholder="Adresse du kiosque"
                      value={formData.kioskAddress || ""}
                      onChange={(e) => setFormData({ ...formData, kioskAddress: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="latitude">Latitude</Label>
                      <Input
                        id="latitude"
                        type="text"
                        placeholder="Latitude"
                        value={formData.gpsLatitude || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            gpsLatitude: e.target.value !== "" ? Number.parseFloat(e.target.value) : null,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="longitude">Longitude</Label>
                      <Input
                        id="longitude"
                        type="text"
                        placeholder="Longitude"
                        value={formData.gpsLongitude || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            gpsLongitude: e.target.value !== "" ? Number.parseFloat(e.target.value) : null,
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Informations client pour MONO */}
                  {(hasClient || selectedClientId) && (
                    <>
                      <div className="border-t pt-2 mt-2">
                        <p className="text-sm font-medium text-gray-500 mb-2">Informations du client</p>
                      </div>

                      <div>
                        <Label htmlFor="products-services">Produits/Services</Label>
                        <Input
                          id="products-services"
                          type="text"
                          placeholder="Produits/Services"
                          value={formData.productTypes || ""}
                          onChange={(e) => setFormData({ ...formData, productTypes: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label htmlFor="manager-name">Nom du gestionnaire</Label>
                        <Input
                          id="manager-name"
                          type="text"
                          placeholder="Nom du responsable"
                          value={formData.managerName || ""}
                          onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label htmlFor="manager-contact">Contact du gestionnaire</Label>
                        <Input
                          id="manager-contact"
                          type="text"
                          placeholder="Contact du responsable"
                          value={formData.managerContacts || ""}
                          onChange={(e) => setFormData({ ...formData, managerContacts: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Pour les kiosques GRAND, afficher uniquement les compartiments */}
              {isGrandKiosk && (
                <>
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm font-medium text-gray-700">
                      Compartiments occupés : <strong className="text-blue-600">{occupiedCount}/3</strong>
                    </p>
                  </div>

                  {/* Compartiment Gauche */}
                  {(() => {
                    const leftComp = getCompartmentData("LEFT")
                    const isOccupied = leftComp?.status === "OCCUPIED"
                    const isMaintenance = leftComp?.status === "UNDER_MAINTENANCE"
                    
                    return (
                      <div className="p-3 rounded-lg bg-white border">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="font-semibold text-base">Compartiment Gauche</Label>
                          <Badge className={
                            isOccupied ? "bg-green-100 text-green-700" :
                            isMaintenance ? "bg-yellow-100 text-yellow-700" :
                            "bg-blue-100 text-blue-700"
                          }>
                            {isOccupied ? "🟢 Occupé" :
                             isMaintenance ? "🟡 Maintenance" :
                             "🔵 Libre"}
                          </Badge>
                        </div>
                        
                        {isOccupied ? (
                          <div>
                            <div className="flex items-center gap-2 mt-1 p-2 bg-gray-50 rounded">
                              <UserRound className="h-4 w-4 text-green-600" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-800">{leftComp?.clientName || "Client non renseigné"}</p>
                                {leftComp?.clientEmail && (
                                  <p className="text-xs text-gray-500">{leftComp.clientEmail}</p>
                                )}
                                {leftComp?.clientPhone && (
                                  <p className="text-xs text-gray-500">{leftComp.clientPhone}</p>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => updateCompartmentStatus("LEFT", "AVAILABLE")}
                                className="text-red-500 hover:text-red-700"
                              >
                                Libérer
                              </Button>
                            </div>
                            <div className="mt-2">
                              <Label>Changer de client</Label>
                              <ClientSelector
                                compartmentType="LEFT"
                                open={openLeftClientSelect}
                                setOpen={setOpenLeftClientSelect}
                                currentClientName={leftComp?.clientName}
                                onSelect={(client) => updateCompartmentClient("LEFT", client)}
                              />
                            </div>
                            <OccupantInfoForm 
                              compartment={leftComp!} 
                              onUpdate={(field, value) => updateCompartmentInfo("LEFT", field, value)}
                            />
                          </div>
                        ) : (
                          <div>
                            <Label>Statut</Label>
                            <Select
                              value={leftComp?.status || "AVAILABLE"}
                              onValueChange={(value) => updateCompartmentStatus("LEFT", value)}
                            >
                              <SelectTrigger className="w-full mt-1">
                                <SelectValue placeholder="Statut" />
                              </SelectTrigger>
                              <SelectContent>
                                {compartmentStatuses.map((status) => (
                                  <SelectItem key={status.value} value={status.value}>
                                    {status.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {leftComp?.status === "OCCUPIED" && (
                              <>
                                <div className="mt-2">
                                  <Label>Sélectionner un client</Label>
                                  <ClientSelector
                                    compartmentType="LEFT"
                                    open={openLeftClientSelect}
                                    setOpen={setOpenLeftClientSelect}
                                    currentClientName={leftComp?.clientName}
                                    onSelect={(client) => updateCompartmentClient("LEFT", client)}
                                  />
                                </div>
                                <OccupantInfoForm 
                                  compartment={leftComp!} 
                                  onUpdate={(field, value) => updateCompartmentInfo("LEFT", field, value)}
                                />
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Compartiment Centre */}
                  {(() => {
                    const middleComp = getCompartmentData("MIDDLE")
                    const isOccupied = middleComp?.status === "OCCUPIED"
                    const isMaintenance = middleComp?.status === "UNDER_MAINTENANCE"
                    
                    return (
                      <div className="p-3 rounded-lg bg-white border">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="font-semibold text-base">Compartiment Centre</Label>
                          <Badge className={
                            isOccupied ? "bg-green-100 text-green-700" :
                            isMaintenance ? "bg-yellow-100 text-yellow-700" :
                            "bg-blue-100 text-blue-700"
                          }>
                            {isOccupied ? "🟢 Occupé" :
                             isMaintenance ? "🟡 Maintenance" :
                             "🔵 Libre"}
                          </Badge>
                        </div>
                        
                        {isOccupied ? (
                          <div>
                            <div className="flex items-center gap-2 mt-1 p-2 bg-gray-50 rounded">
                              <UserRound className="h-4 w-4 text-green-600" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-800">{middleComp?.clientName || "Client non renseigné"}</p>
                                {middleComp?.clientEmail && (
                                  <p className="text-xs text-gray-500">{middleComp.clientEmail}</p>
                                )}
                                {middleComp?.clientPhone && (
                                  <p className="text-xs text-gray-500">{middleComp.clientPhone}</p>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => updateCompartmentStatus("MIDDLE", "AVAILABLE")}
                                className="text-red-500 hover:text-red-700"
                              >
                                Libérer
                              </Button>
                            </div>
                            <div className="mt-2">
                              <Label>Changer de client</Label>
                              <ClientSelector
                                compartmentType="MIDDLE"
                                open={openMiddleClientSelect}
                                setOpen={setOpenMiddleClientSelect}
                                currentClientName={middleComp?.clientName}
                                onSelect={(client) => updateCompartmentClient("MIDDLE", client)}
                              />
                            </div>
                            <OccupantInfoForm 
                              compartment={middleComp!} 
                              onUpdate={(field, value) => updateCompartmentInfo("MIDDLE", field, value)}
                            />
                          </div>
                        ) : (
                          <div>
                            <Label>Statut</Label>
                            <Select
                              value={middleComp?.status || "AVAILABLE"}
                              onValueChange={(value) => updateCompartmentStatus("MIDDLE", value)}
                            >
                              <SelectTrigger className="w-full mt-1">
                                <SelectValue placeholder="Statut" />
                              </SelectTrigger>
                              <SelectContent>
                                {compartmentStatuses.map((status) => (
                                  <SelectItem key={status.value} value={status.value}>
                                    {status.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {middleComp?.status === "OCCUPIED" && (
                              <>
                                <div className="mt-2">
                                  <Label>Sélectionner un client</Label>
                                  <ClientSelector
                                    compartmentType="MIDDLE"
                                    open={openMiddleClientSelect}
                                    setOpen={setOpenMiddleClientSelect}
                                    currentClientName={middleComp?.clientName}
                                    onSelect={(client) => updateCompartmentClient("MIDDLE", client)}
                                  />
                                </div>
                                <OccupantInfoForm 
                                  compartment={middleComp!} 
                                  onUpdate={(field, value) => updateCompartmentInfo("MIDDLE", field, value)}
                                />
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Compartiment Droit */}
                  {(() => {
                    const rightComp = getCompartmentData("RIGHT")
                    const isOccupied = rightComp?.status === "OCCUPIED"
                    const isMaintenance = rightComp?.status === "UNDER_MAINTENANCE"
                    
                    return (
                      <div className="p-3 rounded-lg bg-white border">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="font-semibold text-base">Compartiment Droit</Label>
                          <Badge className={
                            isOccupied ? "bg-green-100 text-green-700" :
                            isMaintenance ? "bg-yellow-100 text-yellow-700" :
                            "bg-blue-100 text-blue-700"
                          }>
                            {isOccupied ? "🟢 Occupé" :
                             isMaintenance ? "🟡 Maintenance" :
                             "🔵 Libre"}
                          </Badge>
                        </div>
                        
                        {isOccupied ? (
                          <div>
                            <div className="flex items-center gap-2 mt-1 p-2 bg-gray-50 rounded">
                              <UserRound className="h-4 w-4 text-green-600" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-800">{rightComp?.clientName || "Client non renseigné"}</p>
                                {rightComp?.clientEmail && (
                                  <p className="text-xs text-gray-500">{rightComp.clientEmail}</p>
                                )}
                                {rightComp?.clientPhone && (
                                  <p className="text-xs text-gray-500">{rightComp.clientPhone}</p>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => updateCompartmentStatus("RIGHT", "AVAILABLE")}
                                className="text-red-500 hover:text-red-700"
                              >
                                Libérer
                              </Button>
                            </div>
                            <div className="mt-2">
                              <Label>Changer de client</Label>
                              <ClientSelector
                                compartmentType="RIGHT"
                                open={openRightClientSelect}
                                setOpen={setOpenRightClientSelect}
                                currentClientName={rightComp?.clientName}
                                onSelect={(client) => updateCompartmentClient("RIGHT", client)}
                              />
                            </div>
                            <OccupantInfoForm 
                              compartment={rightComp!} 
                              onUpdate={(field, value) => updateCompartmentInfo("RIGHT", field, value)}
                            />
                          </div>
                        ) : (
                          <div>
                            <Label>Statut</Label>
                            <Select
                              value={rightComp?.status || "AVAILABLE"}
                              onValueChange={(value) => updateCompartmentStatus("RIGHT", value)}
                            >
                              <SelectTrigger className="w-full mt-1">
                                <SelectValue placeholder="Statut" />
                              </SelectTrigger>
                              <SelectContent>
                                {compartmentStatuses.map((status) => (
                                  <SelectItem key={status.value} value={status.value}>
                                    {status.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {rightComp?.status === "OCCUPIED" && (
                              <>
                                <div className="mt-2">
                                  <Label>Sélectionner un client</Label>
                                  <ClientSelector
                                    compartmentType="RIGHT"
                                    open={openRightClientSelect}
                                    setOpen={setOpenRightClientSelect}
                                    currentClientName={rightComp?.clientName}
                                    onSelect={(client) => updateCompartmentClient("RIGHT", client)}
                                  />
                                </div>
                                <OccupantInfoForm 
                                  compartment={rightComp!} 
                                  onUpdate={(field, value) => updateCompartmentInfo("RIGHT", field, value)}
                                />
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </>
              )}
            </form>
          </ScrollArea>
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              form="kiosk-form"
              type="submit"
              className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isGrandKiosk ? "Mise à jour en cours..." : "Modification en cours..."}
                </>
              ) : (
                isGrandKiosk ? "Mettre à jour" : "Modifier"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialogue de confirmation */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-orange-600">Confirmation requise</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-700 whitespace-pre-line">{confirmMessage}</p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={cancelCategoryChange}>
              Annuler
            </Button>
            <Button 
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => pendingCategoryChange && applyCategoryChange(pendingCategoryChange)}
            >
              Confirmer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}