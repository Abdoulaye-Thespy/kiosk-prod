"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { createContract, getKiosksWithoutPagination, getUsers } from "@/app/actions/contractActions"
import { Loader2, Search, User, MapPin, X, ChevronDown, ChevronUp, Package, CheckCircle, Wrench } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import { Select } from "@/components/ui/select"

export default function NewContractPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSearchingKiosks, setIsSearchingKiosks] = useState(false)
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("user")

  // Kiosk state
  const [kiosks, setKiosks] = useState<any[]>([])
  const [kioskSearchTerm, setKioskSearchTerm] = useState("")
  const [selectedKiosk, setSelectedKiosk] = useState<string | null>(null)
  const [showKioskList, setShowKioskList] = useState(true)

  // User state
  const [users, setUsers] = useState<any[]>([])
  const [userSearchTerm, setUserSearchTerm] = useState("")
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  const [showUserList, setShowUserList] = useState(true)

  // Debounced search
  const [debouncedUserSearch, setDebouncedUserSearch] = useState("")
  const [debouncedKioskSearch, setDebouncedKioskSearch] = useState("")

  // Form state
  const [formData, setFormData] = useState({
    clientName: "",
    clientIdNumber: "",
    clientIdIssuedDate: "",
    clientIdIssuedPlace: "",
    clientAddress: "",
    clientPhone: "",
    clientBusinessAddress: "",
    clientBusinessQuarter: "",
    clientBusinessLocation: "",
    contractDuration: 12,
    paymentFrequency: "Mensuel",
    paymentAmount: 0,
  })

  // Debounce search terms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUserSearch(userSearchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [userSearchTerm])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKioskSearch(kioskSearchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [kioskSearchTerm])

  // Fetch users with debounced search
  const fetchUsers = useCallback(async (search?: string) => {
    setIsSearchingUsers(true)
    try {
      const result = await getUsers(search || debouncedUserSearch)
      if (result.success) {
        setUsers(result.users)
      } else {
        setError(result.error || "Failed to load users")
      }
    } catch (error) {
      console.error("Error fetching users:", error)
      setError("An error occurred while loading users")
    } finally {
      setIsSearchingUsers(false)
    }
  }, [debouncedUserSearch])

  // Fetch kiosks with debounced search
  const fetchKiosks = useCallback(async (search?: string) => {
    setIsSearchingKiosks(true)
    try {
      const result = await getKiosksWithoutPagination({
        searchTerm: search || debouncedKioskSearch,
      })
      if (result.success) {
        setKiosks(result.kiosks)
      } else {
        setError(result.error || "Failed to load kiosks")
      }
    } catch (error) {
      console.error("Error fetching kiosks:", error)
      setError("An error occurred while loading kiosks")
    } finally {
      setIsSearchingKiosks(false)
    }
  }, [debouncedKioskSearch])

  // Initial fetch
  useEffect(() => {
    fetchUsers()
    fetchKiosks()
  }, [])

  // Fetch when debounced search changes
  useEffect(() => {
    if (debouncedUserSearch !== undefined) {
      fetchUsers(debouncedUserSearch)
    }
  }, [debouncedUserSearch, fetchUsers])

  useEffect(() => {
    if (debouncedKioskSearch !== undefined) {
      fetchKiosks(debouncedKioskSearch)
    }
  }, [debouncedKioskSearch, fetchKiosks])

  // Handle user selection
  const handleUserSelection = (user: any) => {
    setSelectedUser(user)
    setShowUserList(false)

    // Populate form with user data
    setFormData((prev) => ({
      ...prev,
      clientName: user.name || "",
      clientPhone: user.phone || "",
      clientAddress: user.address || "",
    }))
  }

  // Handle kiosk selection
  const handleKioskSelection = (kioskId: string) => {
    setSelectedKiosk(kioskId)
    setShowKioskList(false)

    // Find the selected kiosk
    const kiosk = kiosks.find((k) => k.id === kioskId)

    if (kiosk && kiosk.clientName && !selectedUser) {
      // Only populate if no user selected
      setFormData((prev) => ({
        ...prev,
        clientName: kiosk.clientName || "",
        clientPhone: kiosk.clientPhone || "",
        clientAddress: kiosk.clientAddress || "",
      }))
    }
  }

  // Reset user selection
  const resetUserSelection = () => {
    setSelectedUser(null)
    setShowUserList(true)
    setUserSearchTerm("")
    setFormData((prev) => ({
      ...prev,
      clientName: "",
      clientPhone: "",
      clientAddress: "",
    }))
  }

  // Reset kiosk selection
  const resetKioskSelection = () => {
    setSelectedKiosk(null)
    setShowKioskList(true)
    setKioskSearchTerm("")
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleUserSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserSearchTerm(e.target.value)
  }

  const handleKioskSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setKioskSearchTerm(e.target.value)
  }

  const handleUserSearch = () => {
    fetchUsers(userSearchTerm)
  }

  const handleKioskSearch = () => {
    fetchKiosks(kioskSearchTerm)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (!session?.user?.id) {
        throw new Error("User not authenticated")
      }

      if (!selectedKiosk) {
        throw new Error("Please select a kiosk")
      }

      const result = await createContract({
        ...formData,
        kioskIds: [selectedKiosk],
        createdById: session.user.id,
      })

      if (result.success) {
        router.push(`/admin/contrat/${result.contract.id}`)
      } else {
        setError(result.error || "Failed to create contract")
      }
    } catch (error: any) {
      console.error("Error creating contract:", error)
      setError(error.message || "An error occurred while creating the contract")
    } finally {
      setIsLoading(false)
    }
  }

  // Fonction pour afficher le statut d'un compartiment
  const getCompartmentStatusBadge = (status: string) => {
    switch (status) {
      case "OCCUPIED":
        return <Badge className="bg-green-100 text-green-800 text-xs"><CheckCircle className="h-3 w-3 mr-1 inline" /> Occupé</Badge>
      case "AVAILABLE":
        return <Badge className="bg-blue-100 text-blue-800 text-xs"><Package className="h-3 w-3 mr-1 inline" /> Libre</Badge>
      case "UNDER_MAINTENANCE":
        return <Badge className="bg-yellow-100 text-yellow-800 text-xs"><Wrench className="h-3 w-3 mr-1 inline" /> Maintenance</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800 text-xs">{status}</Badge>
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={() => router.back()} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <h1 className="text-3xl font-bold">Nouveau Contrat</h1>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-8">
        <Tabs defaultValue="user" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="user">
              {selectedUser ? "✓ " : ""}Sélection de l'utilisateur
            </TabsTrigger>
            <TabsTrigger value="kiosk" disabled={!selectedUser}>
              {selectedKiosk ? "✓ " : ""}Sélection du kiosque
            </TabsTrigger>
          </TabsList>

          <TabsContent value="user">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Rechercher un utilisateur</h2>
                {selectedUser && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetUserSelection}
                    className="text-orange-500"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Changer d'utilisateur
                  </Button>
                )}
              </div>

              {!selectedUser ? (
                <>
                  <div className="flex gap-2 mb-6">
                    <div className="relative flex-1">
                      <Input
                        placeholder="Rechercher par nom, email ou téléphone..."
                        value={userSearchTerm}
                        onChange={handleUserSearchChange}
                        className="pl-10"
                        autoFocus
                      />
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                    <Button type="button" onClick={handleUserSearch} disabled={isSearchingUsers}>
                      {isSearchingUsers ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rechercher"}
                    </Button>
                  </div>

                  {showUserList && (
                    <div className="space-y-4">
                      <Label>Sélectionnez un utilisateur</Label>

                      {users.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          {isSearchingUsers ? (
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                              <span>Recherche en cours...</span>
                            </div>
                          ) : userSearchTerm ? (
                            "Aucun utilisateur trouvé"
                          ) : (
                            "Commencez à taper pour rechercher des utilisateurs"
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto p-2">
                          {users.map((user) => (
                            <div
                              key={user.id}
                              className={`flex items-start space-x-3 border p-4 rounded-md cursor-pointer hover:bg-gray-50 transition-colors ${
                                selectedUser?.id === user.id ? "border-orange-500 bg-orange-50" : ""
                              }`}
                              onClick={() => handleUserSelection(user)}
                            >
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={user.image || "/placeholder.svg?height=40&width=40"} alt={user.name} />
                                <AvatarFallback>{user.name?.charAt(0) || "U"}</AvatarFallback>
                              </Avatar>
                              <div className="space-y-1 flex-1">
                                <p className="font-medium">{user.name}</p>
                                <div className="flex items-center text-sm text-gray-500">
                                  <User className="h-3 w-3 mr-1" />
                                  {user.email}
                                </div>
                                {user.phone && (
                                  <div className="flex items-center text-sm text-gray-500">
                                    <MapPin className="h-3 w-3 mr-1" />
                                    {user.phone}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-gray-400 whitespace-nowrap">
                                <Badge variant={user.status === "VERIFIED" ? "default" : "secondary"} className={
                                  user.status === "VERIFIED" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                                }>
                                  {user.status === "VERIFIED" ? "Actif" : "Inactif"}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-green-600 text-white">
                          {selectedUser.name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-lg">{selectedUser.name}</p>
                        <p className="text-sm text-gray-600">{selectedUser.email}</p>
                        {selectedUser.phone && <p className="text-sm text-gray-600">Tel: {selectedUser.phone}</p>}
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800">
                      Utilisateur sélectionné
                    </Badge>
                  </div>
                  <p className="text-sm text-green-700 mt-3 pt-2 border-t border-green-200">
                    Les informations de cet utilisateur seront utilisées pour le contrat.
                  </p>
                </div>
              )}

              {selectedUser && (
                <div className="flex justify-end mt-4">
                  <Button
                    type="button"
                    onClick={() => setActiveTab("kiosk")}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    Continuer vers la sélection du kiosque
                  </Button>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="kiosk">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Sélection du Kiosque</h2>
                {selectedKiosk && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetKioskSelection}
                    className="text-orange-500"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Changer de kiosque
                  </Button>
                )}
              </div>

              {!selectedKiosk ? (
                <>
                  <div className="flex gap-2 mb-6">
                    <div className="relative flex-1">
                      <Input
                        placeholder="Rechercher par nom, matricule, adresse..."
                        value={kioskSearchTerm}
                        onChange={handleKioskSearchChange}
                        className="pl-10"
                        autoFocus
                      />
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                    <Button type="button" onClick={handleKioskSearch} disabled={isSearchingKiosks}>
                      {isSearchingKiosks ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rechercher"}
                    </Button>
                  </div>

                  {showKioskList && (
                    <div className="space-y-4">
                      <Label>Sélectionnez un kiosque*</Label>

                      {kiosks.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          {isSearchingKiosks ? (
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                              <span>Recherche en cours...</span>
                            </div>
                          ) : kioskSearchTerm ? (
                            "Aucun kiosque trouvé"
                          ) : (
                            "Commencez à taper pour rechercher des kiosques"
                          )}
                        </div>
                      ) : (
                        <RadioGroup value={selectedKiosk || ""} onValueChange={handleKioskSelection}>
                          <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto p-2">
                            {kiosks.map((kiosk) => (
                              <div
                                key={kiosk.id}
                                className={`flex items-start space-x-2 border p-4 rounded-md cursor-pointer hover:bg-gray-50 transition-colors ${
                                  selectedKiosk === kiosk.id ? "border-orange-500 bg-orange-50" : ""
                                }`}
                                onClick={() => handleKioskSelection(kiosk.id)}
                              >
                                <RadioGroupItem value={kiosk.id} id={`kiosk-${kiosk.id}`} />
                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center justify-between">
                                    <Label htmlFor={`kiosk-${kiosk.id}`} className="font-medium cursor-pointer">
                                      {kiosk.kioskName || kiosk.kioskMatricule}
                                    </Label>
                                    <Badge className={
                                      kiosk.kioskType === "MONO" ? "bg-orange-100 text-orange-800" : "bg-purple-100 text-purple-800"
                                    }>
                                      {kiosk.kioskType === "MONO" ? "MONO" : "GRAND"}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-500">{kiosk.kioskAddress || "Adresse non renseignée"}</p>
                                  <p className="text-xs text-gray-400">Matricule: {kiosk.kioskMatricule}</p>

                                  {/* Affichage des compartiments pour les kiosques GRAND */}
                                  {kiosk.kioskType === "GRAND" && kiosk.compartments && kiosk.compartments.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                      <p className="text-xs font-medium text-gray-500 mb-1">Compartiments:</p>
                                      <div className="flex gap-2">
                                        {kiosk.compartments.map((comp: any) => (
                                          <div key={comp.id} className="flex items-center gap-1">
                                            <span className="text-xs font-medium text-gray-600">
                                              {comp.compartmentType === "LEFT" ? "Gauche" :
                                               comp.compartmentType === "MIDDLE" ? "Centre" :
                                               comp.compartmentType === "RIGHT" ? "Droit" : comp.compartmentType}:
                                            </span>
                                            {getCompartmentStatusBadge(comp.status)}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {kiosk.clientName && (
                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                      <p className="text-sm font-medium">Client actuel:</p>
                                      <p className="text-sm">{kiosk.clientName}</p>
                                      {kiosk.clientPhone && <p className="text-xs text-gray-500">{kiosk.clientPhone}</p>}
                                    </div>
                                  )}
                                </div>
                                <div className="text-xs whitespace-nowrap">
                                  <Badge className={
                                    kiosk.status === "ACTIVE" ? "bg-green-100 text-green-800" :
                                    kiosk.status === "AVAILABLE" ? "bg-blue-100 text-blue-800" :
                                    "bg-gray-100 text-gray-800"
                                  }>
                                    {kiosk.status === "ACTIVE" ? "Occupé" :
                                     kiosk.status === "AVAILABLE" ? "Disponible" : kiosk.status}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </RadioGroup>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-lg">
                        {kiosks.find((k) => k.id === selectedKiosk)?.kioskName || selectedKiosk}
                      </p>
                      <p className="text-sm text-gray-600">
                        {kiosks.find((k) => k.id === selectedKiosk)?.kioskAddress || "Adresse non renseignée"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Matricule: {kiosks.find((k) => k.id === selectedKiosk)?.kioskMatricule}
                      </p>
                      
                      {/* Affichage des compartiments pour le kiosque GRAND sélectionné */}
                      {(() => {
                        const selectedKioskData = kiosks.find((k) => k.id === selectedKiosk)
                        if (selectedKioskData?.kioskType === "GRAND" && selectedKioskData?.compartments?.length > 0) {
                          return (
                            <div className="mt-3 pt-2 border-t border-blue-200">
                              <p className="text-xs font-medium text-gray-500 mb-1">État des compartiments:</p>
                              <div className="flex gap-3">
                                {selectedKioskData.compartments.map((comp: any) => (
                                  <div key={comp.id} className="flex items-center gap-1">
                                    <span className="text-sm font-medium text-gray-700">
                                      {comp.compartmentType === "LEFT" ? "Gauche" :
                                       comp.compartmentType === "MIDDLE" ? "Centre" :
                                       comp.compartmentType === "RIGHT" ? "Droit" : comp.compartmentType}:
                                    </span>
                                    {getCompartmentStatusBadge(comp.status)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        }
                        return null
                      })()}
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">
                      Kiosque sélectionné
                    </Badge>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>

        {/* Formulaire client - visible seulement quand les deux étapes sont complétées */}
        {selectedUser && selectedKiosk && (
          <>
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Informations du Client</h2>
              {selectedUser && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-700">
                    Les informations ont été pré-remplies à partir des données de l'utilisateur sélectionné.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Nom complet*</Label>
                  <Input
                    id="clientName"
                    name="clientName"
                    value={formData.clientName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientPhone">Téléphone</Label>
                  <Input id="clientPhone" name="clientPhone" value={formData.clientPhone} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientIdNumber">N° CNI/RECEPISSE</Label>
                  <Input
                    id="clientIdNumber"
                    name="clientIdNumber"
                    value={formData.clientIdNumber}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientIdIssuedDate">Date de délivrance</Label>
                  <Input
                    id="clientIdIssuedDate"
                    name="clientIdIssuedDate"
                    type="date"
                    value={formData.clientIdIssuedDate}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientIdIssuedPlace">Lieu de délivrance</Label>
                  <Input
                    id="clientIdIssuedPlace"
                    name="clientIdIssuedPlace"
                    value={formData.clientIdIssuedPlace}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientAddress">Adresse domicile</Label>
                  <Input
                    id="clientAddress"
                    name="clientAddress"
                    value={formData.clientAddress}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientBusinessAddress">Adresse professionnelle</Label>
                  <Input
                    id="clientBusinessAddress"
                    name="clientBusinessAddress"
                    value={formData.clientBusinessAddress}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientBusinessQuarter">Quartier</Label>
                  <Input
                    id="clientBusinessQuarter"
                    name="clientBusinessQuarter"
                    value={formData.clientBusinessQuarter}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="clientBusinessLocation">Lieu-dit</Label>
                  <Input
                    id="clientBusinessLocation"
                    name="clientBusinessLocation"
                    value={formData.clientBusinessLocation}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Détails du Contrat</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contractDuration">Durée (mois)*</Label>
                  <Input
                    id="contractDuration"
                    name="contractDuration"
                    type="number"
                    min="1"
                    value={formData.contractDuration}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentFrequency">Fréquence de paiement*</Label>
                  <Select
                    value={formData.paymentFrequency}
                    onValueChange={(value) => handleSelectChange("paymentFrequency", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mensuel">Mensuel</SelectItem>
                      <SelectItem value="Trimestriel">Trimestriel</SelectItem>
                      <SelectItem value="Semestriel">Semestriel</SelectItem>
                      <SelectItem value="Annuel">Annuel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentAmount">Montant (FCFA)*</Label>
                  <Input
                    id="paymentAmount"
                    name="paymentAmount"
                    type="number"
                    min="0"
                    value={formData.paymentAmount}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            </Card>

            <div className="flex justify-end space-x-4">
              <Button variant="outline" type="button" onClick={() => router.back()}>
                Annuler
              </Button>
              <Button
                type="submit"
                className="bg-orange-500 hover:bg-orange-600 text-white"
                disabled={isLoading || !selectedKiosk}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création en cours...
                  </>
                ) : (
                  "Créer le contrat"
                )}
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}