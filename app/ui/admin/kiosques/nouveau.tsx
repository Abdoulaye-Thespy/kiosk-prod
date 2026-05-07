"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, CheckCircle2, XCircle, Search, UserRound, MapPin, Navigation, Building2, Phone, Mail, Info, InfoIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { addKioskByStaff } from "@/app/actions/kiosk-actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { fetchClients } from "@/app/actions/fetchUserStats"
import { Badge } from "@/components/ui/badge"
import type { KioskTown, KioskType } from "@prisma/client"

interface Client {
  id: string
  name: string
  email: string
  phone?: string
}

interface CompartmentData {
  compartmentType: string
  status: string
  clientId?: string | null
  clientName?: string
  clientEmail?: string
  clientPhone?: string
  notes?: string
}

import type { Kiosk } from "@prisma/client"

interface AddKioskDialogProps {
  kiosks: Kiosk[]
  onSuccess: (addedKiosk: Kiosk) => void
}

export function AddKioskDialog({ kiosks, onSuccess }: AddKioskDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [selectedClientName, setSelectedClientName] = useState<string>("")
  const [openClientSelect, setOpenClientSelect] = useState(false)
  const [isLoadingClients, setIsLoadingClients] = useState(false)
  const [clientsLoaded, setClientsLoaded] = useState(false)

  // États pour les compartiments (pour GRAND)
  const [compartments, setCompartments] = useState<CompartmentData[]>([
    { compartmentType: "LEFT", status: "AVAILABLE" },
    { compartmentType: "MIDDLE", status: "AVAILABLE" },
    { compartmentType: "RIGHT", status: "AVAILABLE" },
  ])

  // États pour la sélection de client par compartiment
  const [openLeftClientSelect, setOpenLeftClientSelect] = useState(false)
  const [openMiddleClientSelect, setOpenMiddleClientSelect] = useState(false)
  const [openRightClientSelect, setOpenRightClientSelect] = useState(false)

  const initialFormData = {
    kioskName: "",
    kioskAddress: "BEKOKO (Entrepôt)",
    latitude: "",
    longitude: "",
    kioskType: "",
    productTypes: "",
    managerName: "",
    managerContacts: "",
    kioskMatricule: "",
    kioskTown: "DOUALA" as KioskTown,
  }

  const [formData, setFormData] = useState(initialFormData)
  const [selectedKioskType, setSelectedKioskType] = useState<string>("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({})

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }))
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: false }))
    }
  }

  // Synchroniser le nom de l'entreprise avec le matricule (en arrière-plan)
  const handleMatriculeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFormData((prevData) => ({
      ...prevData,
      kioskMatricule: value,
      kioskName: value, // Synchronisation silencieuse en arrière-plan
    }))
    if (fieldErrors.kioskMatricule) {
      setFieldErrors((prev) => ({ ...prev, kioskMatricule: false }))
    }
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }))
  }

  const handleKioskTypeChange = (value: string) => {
    setSelectedKioskType(value)
    setFormData((prevData) => ({
      ...prevData,
      kioskType: value,
    }))
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setSelectedKioskType("")
    setSelectedClientId("")
    setSelectedClientName("")
    setCompartments([
      { compartmentType: "LEFT", status: "AVAILABLE" },
      { compartmentType: "MIDDLE", status: "AVAILABLE" },
      { compartmentType: "RIGHT", status: "AVAILABLE" },
    ])
    setFieldErrors({})
    setError(null)
    setSuccess(null)
  }

  const getSelectedClientDisplay = () => {
    if (!selectedClientId) {
      return "Sélectionner un client (optionnel)"
    }
    const foundClient = clients.find((client) => client.id === selectedClientId)
    if (foundClient) {
      return foundClient.name
    }
    return selectedClientName || "Client sélectionné"
  }

  // Mettre à jour le statut d'un compartiment
  const updateCompartmentStatus = (compartmentType: string, status: string) => {
    setCompartments(prev =>
      prev.map(comp =>
        comp.compartmentType === compartmentType
          ? { ...comp, status, clientId: null, clientName: undefined, clientEmail: undefined, clientPhone: undefined }
          : comp
      )
    )
  }

  // Mettre à jour le client d'un compartiment
  const updateCompartmentClient = (compartmentType: string, client: Client) => {
    setCompartments(prev =>
      prev.map(comp =>
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
      )
    )
  }

  // Mettre à jour les informations d'un compartiment
  const updateCompartmentInfo = (compartmentType: string, field: string, value: any) => {
    setCompartments(prev =>
      prev.map(comp =>
        comp.compartmentType === compartmentType
          ? { ...comp, [field]: value }
          : comp
      )
    )
  }

  const ClientSelector = ({
    open,
    setOpen,
    currentClientName,
    onSelect
  }: {
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
            <CommandEmpty>
              {isLoadingClients ? "Chargement des clients..." : "Aucun client trouvé."}
            </CommandEmpty>
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

  const OccupantInfoForm = ({ compartment, onUpdate }: { compartment: CompartmentData; onUpdate: (field: string, value: any) => void }) => (
    <div className="mt-3 space-y-2 pt-2 border-t border-gray-100">
      <p className="text-xs font-medium text-gray-500 mb-2">Informations de l'occupant</p>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <UserRound className="h-3 w-3 text-gray-400" />
          <Input
            type="text"
            value={compartment.clientName || ""}
            onChange={(e) => onUpdate("clientName", e.target.value)}
            className="text-sm flex-1"
            placeholder="Nom du client"
          />
        </div>
        <div className="flex items-center gap-2">
          <Mail className="h-3 w-3 text-gray-400" />
          <Input
            type="email"
            value={compartment.clientEmail || ""}
            onChange={(e) => onUpdate("clientEmail", e.target.value)}
            className="text-sm flex-1"
            placeholder="Email du client"
          />
        </div>
        <div className="flex items-center gap-2">
          <Phone className="h-3 w-3 text-gray-400" />
          <Input
            type="tel"
            value={compartment.clientPhone || ""}
            onChange={(e) => onUpdate("clientPhone", e.target.value)}
            className="text-sm flex-1"
            placeholder="Téléphone du client"
          />
        </div>
      </div>
    </div>
  )

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    const requiredFields = ["kioskType", "kioskMatricule", "kioskAddress"]
    const newFieldErrors = requiredFields.reduce(
      (acc, field) => {
        acc[field] = !formData[field as keyof typeof formData]
        return acc
      },
      {} as Record<string, boolean>,
    )

    setFieldErrors(newFieldErrors)

    if (Object.values(newFieldErrors).some(Boolean)) {
      setError("Veuillez remplir tous les champs obligatoires.")
      setIsSubmitting(false)
      return
    }

    const submitData = new FormData()
    Object.entries(formData).forEach(([key, value]) => {
      if (value) {
        submitData.append(key, value)
      }
    })

    // Ajouter le client sélectionné pour MONO
    if (selectedClientId && selectedKioskType === "MONO") {
      submitData.append("userId", selectedClientId)
      submitData.append("clientName", selectedClientName)
    }

    // Pour les kiosques GRAND, ajouter les compartiments
    if (selectedKioskType === "GRAND") {
      const compartmentsData = {
        left: compartments.find(c => c.compartmentType === "LEFT"),
        middle: compartments.find(c => c.compartmentType === "MIDDLE"),
        right: compartments.find(c => c.compartmentType === "RIGHT"),
      }
      submitData.append("compartments", JSON.stringify(compartmentsData))
    }

    try {
      const result = await addKioskByStaff(submitData)
      if (result.error) {
        setError(result.error)
      } else {
        const addedKiosk = result.kiosk
        onSuccess(addedKiosk)
        resetForm()
        setSuccess("Le kiosque a été ajouté avec succès.")
        setTimeout(() => {
          setIsOpen(false)
          resetForm()
        }, 2000)
      }
    } catch (err) {
      setError("Une erreur est survenue lors de l'ajout du kiosque.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const isGrandKiosk = selectedKioskType === "GRAND"
  const isMonoKiosk = selectedKioskType === "MONO"
  const hasClient = !!selectedClientId

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className="bg-orange-500 hover:bg-orange-600 text-white">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="mr-2"
        >
          <path
            d="M8 2v12M2 8h12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Ajouter un nouveau kiosque
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open)
        if (!open) resetForm()
      }}>
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-xl font-semibold">Ajouter un nouveau kiosque</DialogTitle>
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
            <form id="add-kiosk-form" onSubmit={handleSubmit} className="space-y-3 pr-4">
              <p className="text-sm text-muted-foreground mb-4">
                Les champs marqués d'un astérisque (*) sont obligatoires.
              </p>

              {/* Informations générales du kiosque */}
              <div>
                <Label htmlFor="kiosk-matricule" className={fieldErrors.kioskMatricule ? "text-red-500" : ""}>
                  Matricule du kiosque *
                </Label>
                <Input
                  id="kiosk-matricule"
                  name="kioskMatricule"
                  value={formData.kioskMatricule}
                  onChange={handleMatriculeChange}
                  placeholder="K-000-0000-000"
                  className={`w-full mt-1 ${fieldErrors.kioskMatricule ? "border-red-500" : ""}`}
                />
                <p className="text-xs text-gray-400 mt-1">Le nom de l'entreprise sera automatiquement synchronisé avec le matricule</p>
              </div>

              {/* Champ Nom de l'Entreprise caché mais synchronisé */}
              <input type="hidden" name="kioskName" value={formData.kioskName} />

              <div>
                <Label htmlFor="kiosk-address" className={fieldErrors.kioskAddress ? "text-red-500" : ""}>
                  Adresse du kiosque *
                </Label>
                <Input
                  id="kiosk-address"
                  name="kioskAddress"
                  value={formData.kioskAddress}
                  onChange={handleChange}
                  placeholder="Adresse du kiosque"
                  className={`w-full mt-1 ${fieldErrors.kioskAddress ? "border-red-500" : ""}`}
                />
                <div className="flex items-center gap-1 mt-1">
                  <Info className="h-3 w-3 text-blue-400" />
                  <p className="text-xs text-blue-500">Valeur par défaut: BEKOKO (Entrepôt) - Modifiable si le kiosque est déployé sur le terrain</p>
                </div>
              </div>

              <div>
                <Label htmlFor="kiosk-town">Ville du kiosque</Label>
                <Select value={formData.kioskTown} onValueChange={(value) => handleSelectChange("kioskTown", value)}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Sélectionner une ville" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DOUALA">Douala</SelectItem>
                    <SelectItem value="YAOUNDE">Yaoundé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="latitude">Latitude (optionnel)</Label>
                  <Input
                    id="latitude"
                    name="latitude"
                    value={formData.latitude}
                    onChange={handleChange}
                    placeholder="Latitude"
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="longitude">Longitude (optionnel)</Label>
                  <Input
                    id="longitude"
                    name="longitude"
                    value={formData.longitude}
                    onChange={handleChange}
                    placeholder="Longitude"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Type de kiosque */}
              <div>
                <div className="flex items-center">
                  <Label className={fieldErrors.kioskType ? "text-red-500" : ""}>Type de kiosque *</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InfoIcon className="h-4 w-4 ml-2 text-gray-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Choisissez le type de kiosque selon ses caractéristiques et services offerts.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                  {[
                    { type: "MONO", label: "MONO (1 compartiment)", description: "Kiosque à 1 compartiment" },
                    { type: "GRAND", label: "GRAND (3 compartiments)", description: "Kiosque à 3 compartiments" },
                  ].map(({ type, label, description }) => (
                    <div key={type} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id={`type-${type}`}
                        name="kioskType"
                        value={type}
                        checked={selectedKioskType === type}
                        onChange={(e) => handleKioskTypeChange(e.target.value)}
                        className="h-4 w-4 border-gray-300 text-orange-600 focus:ring-orange-600"
                      />
                      <Label htmlFor={`type-${type}`} className="cursor-pointer">
                        {label}
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoIcon className="h-4 w-4 text-gray-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pour les kiosques MONO */}
              {isMonoKiosk && (
                <>
                  <div>
                    <Label htmlFor="client-select">Client (optionnel)</Label>
                    <Popover open={openClientSelect} onOpenChange={setOpenClientSelect}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          {getSelectedClientDisplay()}
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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

                  {hasClient && (
                    <>
                      <div className="border-t pt-2 mt-2">
                        <p className="text-sm font-medium text-gray-500 mb-2">Informations du client</p>
                      </div>

                      <div>
                        <Label htmlFor="products-services">Produits/Services</Label>
                        <Input
                          id="products-services"
                          name="productTypes"
                          value={formData.productTypes}
                          onChange={handleChange}
                          placeholder="Produits et services"
                          className="w-full mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="manager-name">Nom du gestionnaire</Label>
                        <Input
                          id="manager-name"
                          name="managerName"
                          value={formData.managerName}
                          onChange={handleChange}
                          placeholder="Nom du responsable"
                          className="w-full mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="manager-contact">Contact du gestionnaire</Label>
                        <Input
                          id="manager-contact"
                          name="managerContacts"
                          value={formData.managerContacts}
                          onChange={handleChange}
                          placeholder="+237 123 456 789"
                          className="w-full mt-1"
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Pour les kiosques GRAND - Compartiments */}
              {isGrandKiosk && (
                <>
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm font-medium text-gray-700">
                      Configurez les 3 compartiments du kiosque GRAND
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Chaque compartiment peut être assigné à un client différent</p>
                  </div>

                  {/* Compartiment Gauche */}
                  {(() => {
                    const leftComp = compartments.find(c => c.compartmentType === "LEFT")!
                    const isOccupied = leftComp.status === "OCCUPIED"
                    
                    return (
                      <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="font-semibold text-base text-orange-800">📦 Compartiment Gauche</Label>
                          <Badge className={isOccupied ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}>
                            {isOccupied ? "🟢 Occupé" : "🔵 Libre"}
                          </Badge>
                        </div>
                        
                        <div>
                          <Label>Statut</Label>
                          <Select
                            value={leftComp.status}
                            onValueChange={(value) => updateCompartmentStatus("LEFT", value)}
                          >
                            <SelectTrigger className="w-full mt-1">
                              <SelectValue placeholder="Statut" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AVAILABLE">🔵 Libre</SelectItem>
                              <SelectItem value="OCCUPIED">🟢 Occupé</SelectItem>
                              <SelectItem value="UNDER_MAINTENANCE">🟡 Maintenance</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {leftComp.status === "OCCUPIED" && (
                          <>
                            <div className="mt-2">
                              <ClientSelector
                                open={openLeftClientSelect}
                                setOpen={setOpenLeftClientSelect}
                                currentClientName={leftComp.clientName}
                                onSelect={(client) => updateCompartmentClient("LEFT", client)}
                              />
                            </div>
                            <OccupantInfoForm 
                              compartment={leftComp} 
                              onUpdate={(field, value) => updateCompartmentInfo("LEFT", field, value)}
                            />
                          </>
                        )}
                      </div>
                    )
                  })()}

                  {/* Compartiment Centre */}
                  {(() => {
                    const middleComp = compartments.find(c => c.compartmentType === "MIDDLE")!
                    const isOccupied = middleComp.status === "OCCUPIED"
                    
                    return (
                      <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="font-semibold text-base text-orange-800">📦 Compartiment Centre</Label>
                          <Badge className={isOccupied ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}>
                            {isOccupied ? "🟢 Occupé" : "🔵 Libre"}
                          </Badge>
                        </div>
                        
                        <div>
                          <Label>Statut</Label>
                          <Select
                            value={middleComp.status}
                            onValueChange={(value) => updateCompartmentStatus("MIDDLE", value)}
                          >
                            <SelectTrigger className="w-full mt-1">
                              <SelectValue placeholder="Statut" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AVAILABLE">🔵 Libre</SelectItem>
                              <SelectItem value="OCCUPIED">🟢 Occupé</SelectItem>
                              <SelectItem value="UNDER_MAINTENANCE">🟡 Maintenance</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {middleComp.status === "OCCUPIED" && (
                          <>
                            <div className="mt-2">
                              <ClientSelector
                                open={openMiddleClientSelect}
                                setOpen={setOpenMiddleClientSelect}
                                currentClientName={middleComp.clientName}
                                onSelect={(client) => updateCompartmentClient("MIDDLE", client)}
                              />
                            </div>
                            <OccupantInfoForm 
                              compartment={middleComp} 
                              onUpdate={(field, value) => updateCompartmentInfo("MIDDLE", field, value)}
                            />
                          </>
                        )}
                      </div>
                    )
                  })()}

                  {/* Compartiment Droit */}
                  {(() => {
                    const rightComp = compartments.find(c => c.compartmentType === "RIGHT")!
                    const isOccupied = rightComp.status === "OCCUPIED"
                    
                    return (
                      <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="font-semibold text-base text-orange-800">📦 Compartiment Droit</Label>
                          <Badge className={isOccupied ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}>
                            {isOccupied ? "🟢 Occupé" : "🔵 Libre"}
                          </Badge>
                        </div>
                        
                        <div>
                          <Label>Statut</Label>
                          <Select
                            value={rightComp.status}
                            onValueChange={(value) => updateCompartmentStatus("RIGHT", value)}
                          >
                            <SelectTrigger className="w-full mt-1">
                              <SelectValue placeholder="Statut" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AVAILABLE">🔵 Libre</SelectItem>
                              <SelectItem value="OCCUPIED">🟢 Occupé</SelectItem>
                              <SelectItem value="UNDER_MAINTENANCE">🟡 Maintenance</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {rightComp.status === "OCCUPIED" && (
                          <>
                            <div className="mt-2">
                              <ClientSelector
                                open={openRightClientSelect}
                                setOpen={setOpenRightClientSelect}
                                currentClientName={rightComp.clientName}
                                onSelect={(client) => updateCompartmentClient("RIGHT", client)}
                              />
                            </div>
                            <OccupantInfoForm 
                              compartment={rightComp} 
                              onUpdate={(field, value) => updateCompartmentInfo("RIGHT", field, value)}
                            />
                          </>
                        )}
                      </div>
                    )
                  })()}
                </>
              )}

              <input type="hidden" name="userId" value={selectedClientId} />
              <input type="hidden" name="clientName" value={selectedClientName} />
              <input type="hidden" name="kioskType" value={selectedKioskType} />
            </form>
          </ScrollArea>
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Annuler
            </Button>
            <Button
              form="add-kiosk-form"
              type="submit"
              className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ajout en cours...
                </>
              ) : (
                "Ajouter"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}