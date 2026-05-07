"use server"

import { sendClientNotification, sendStaffNotificationIndividual } from "@/lib/email"
import { prisma } from "@/lib/prisma"
import {
  KioskType,
  type KioskStatus,
  PrismaClient,
  Role,
  KioskTown,
  CompartmentType,
  CompartmentStatus
} from "@prisma/client"

// Updated type definitions
type KioskFormData = {
  kioskName: string
  clientName?: string
  kioskAddress: string
  gpsLatitude?: string
  gpsLongitude?: string
  productTypes?: string
  kioskType: KioskType
  managerName?: string
  managerContacts?: string
  status: KioskStatus
  userId?: string
  kioskMatricule: string
  kioskTown: KioskTown
}

type CompartmentData = {
  compartmentType: CompartmentType
  status: CompartmentStatus
  clientId?: string
  customName?: string
  monthlyRevenue?: number
}

// Helper function to generate compartments based on kiosk type
function generateCompartmentsForKiosk(
  kioskType: KioskType,
  kioskId: number,
  clientId?: string
): CompartmentData[] {
  if (kioskType === "MONO") {
    return [{
      compartmentType: "SINGLE",
      status: clientId ? "OCCUPIED" : "AVAILABLE",
      clientId: clientId,
      customName: "Compartiment Unique"
    }]
  } else { // GRAND kiosk
    return [
      {
        compartmentType: "LEFT",
        status: "AVAILABLE",
        customName: "Compartiment Gauche"
      },
      {
        compartmentType: "MIDDLE",
        status: "AVAILABLE",
        customName: "Compartiment Centre"
      },
      {
        compartmentType: "RIGHT",
        status: "AVAILABLE",
        customName: "Compartiment Droit"
      }
    ]
  }
}

// Add kiosk by staff
export async function addKioskByStaff(formData: FormData) {
  const kioskData: KioskFormData = {
    clientName: formData.get("clientName") as string,
    kioskName: formData.get("kioskName") as string,
    kioskAddress: formData.get("kioskAddress") as string,
    gpsLatitude: formData.get("latitude") as string,
    gpsLongitude: formData.get("longitude") as string,
    kioskType: formData.get("kioskType") as KioskType,
    productTypes: formData.get("productTypes") as string,
    managerName: formData.get("managerName") as string,
    managerContacts: formData.get("managerContacts") as string,
    kioskMatricule: formData.get("kioskMatricule") as string,
    userId: formData.get("userId") as string,
    status: formData.get("status") as KioskStatus,
    kioskTown: formData.get("kioskTown") as KioskTown,
  }

  try {
    if (!kioskData.kioskType || !kioskData.kioskMatricule) {
      return { error: "Veuillez remplir tous les champs obligatoires." }
    }

    // Determine the status based on conditions
    let kioskStatus: KioskStatus = "AVAILABLE";

    if (!kioskData.userId) {
      const hasGpsCoordinates = kioskData.gpsLatitude && kioskData.gpsLongitude &&
        kioskData.gpsLatitude.trim() !== "" && kioskData.gpsLongitude.trim() !== "";

      if (hasGpsCoordinates) {
        kioskStatus = "UNACTIVE";
      } else if (kioskData.kioskMatricule && kioskData.kioskMatricule.trim() !== "") {
        kioskStatus = "IN_STOCK";
      }
    } else if (kioskData.status) {
      kioskStatus = kioskData.status;
    }

    // Create the kiosk with compartments
    const newKiosk = await prisma.kiosk.create({
      data: {
        kioskName: kioskData.kioskName,
        kioskType: kioskData.kioskType,
        kioskAddress: kioskData.kioskAddress,
        gpsLatitude: kioskData.gpsLatitude ? parseFloat(kioskData.gpsLatitude) : null,
        gpsLongitude: kioskData.gpsLongitude ? parseFloat(kioskData.gpsLongitude) : null,
        productTypes: kioskData.productTypes,
        managerName: kioskData.managerName,
        managerContacts: kioskData.managerContacts,
        kioskMatricule: kioskData.kioskMatricule,
        status: kioskStatus,
        kioskTown: kioskData.kioskTown,
        monoClientId: kioskData.kioskType === "MONO" && kioskData.userId ? kioskData.userId : null,
        compartments: {
          create: generateCompartmentsForKiosk(
            kioskData.kioskType,
            0,
            kioskData.kioskType === "MONO" && kioskData.userId ? kioskData.userId : undefined
          )
        }
      },
    })

    // Create kiosk assignment if userId is provided
    if (kioskData.userId) {
      await prisma.kioskAssignment.create({
        data: {
          kioskId: newKiosk.id,
          userId: kioskData.userId,
          role: "CLIENT",
          assignedBy: kioskData.userId,
          isActive: true
        },
      })

      // For MONO kiosks, update the compartment with client
      if (kioskData.kioskType === "MONO") {
        await prisma.kioskCompartment.updateMany({
          where: { kioskId: newKiosk.id, compartmentType: "SINGLE" },
          data: {
            clientId: kioskData.userId,
            status: "OCCUPIED"
          }
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: kioskData.userId },
      })

      if (user) {
        await sendClientNotification(user.email, newKiosk.kioskName, newKiosk.kioskAddress)
      }
    }

    return { message: "Kiosque ajouté avec succès!", kiosk: newKiosk }
  } catch (error) {
    console.error("Error adding kiosk by staff:", error)
    return { error: "Une erreur est survenue lors de l'ajout du kiosque." }
  }
}

// Get kiosk counts with compartment support
export async function getKioskCounts() {
  try {
    const totalKiosks = await prisma.kiosk.count()

    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const kiosksAddedThisMonth = await prisma.kiosk.count({
      where: {
        createdAt: {
          gte: firstDayOfMonth,
        },
      },
    })

    const percentageAddedThisMonth = totalKiosks > 0 ? (kiosksAddedThisMonth / totalKiosks) * 100 : 0

    // Get compartment counts
    const compartmentCounts = await prisma.kioskCompartment.groupBy({
      by: ["status"],
      _count: { _all: true }
    })

    // Get kiosk counts by type and status
    const kioskCounts = await prisma.kiosk.groupBy({
      by: ["kioskType", "status", "kioskTown"],
      _count: { _all: true },
    })

    // Récupérer la liste des kiosques GRAND avec leurs compartiments pour les statistiques par ville
    const grandKiosksWithCompartments = await prisma.kiosk.findMany({
      where: {
        kioskType: "GRAND"
      },
      include: {
        compartments: true
      }
    })

    const counts = {
      totalKiosks,
      kiosksAddedThisMonth,
      percentageAddedThisMonth,
      kiosks: {
        MONO: {
          total: 0,
          REQUEST: 0,
          IN_STOCK: 0,
          ACTIVE: 0,
          UNACTIVE: 0,
          ACTIVE_UNDER_MAINTENANCE: 0,
          UNACTIVE_UNDER_MAINTENANCE: 0,
          AVAILABLE: 0,
          LOCALIZING: 0,
        },
        GRAND: {
          total: 0,
          REQUEST: 0,
          IN_STOCK: 0,
          ACTIVE: 0,
          UNACTIVE: 0,
          ACTIVE_UNDER_MAINTENANCE: 0,
          UNACTIVE_UNDER_MAINTENANCE: 0,
          AVAILABLE: 0,
          LOCALIZING: 0,
        },
      },
      compartments: {
        AVAILABLE: 0,
        OCCUPIED: 0,
        RESERVED: 0,
        UNDER_MAINTENANCE: 0,
      },
      towns: {
        DOUALA: {
          MONO: { 
            total: 0, 
            available: 0,
            occupied: 0,
            underMaintenance: 0,
            instock: 0
          },
          GRAND: { 
            total: 0, 
            available: 0,
            occupied: 0,
            underMaintenance: 0,
            instock: 0,
            compartments: {
              available: 0,
              occupied: 0,
              underMaintenance: 0,
              total: 0
            }
          },
        },
        YAOUNDE: {
          MONO: { 
            total: 0, 
            available: 0,
            occupied: 0,
            underMaintenance: 0,
            instock: 0
          },
          GRAND: { 
            total: 0, 
            available: 0,
            occupied: 0,
            underMaintenance: 0,
            instock: 0,
            compartments: {
              available: 0,
              occupied: 0,
              underMaintenance: 0,
              total: 0
            }
          },
        },
      },
    }

    // Process kiosk counts
    kioskCounts.forEach(({ kioskType, status, kioskTown, _count }) => {
      const type = kioskType as keyof typeof counts.kiosks;
      if (counts.kiosks[type] && counts.kiosks[type][status] !== undefined) {
        counts.kiosks[type][status] += _count._all
        counts.kiosks[type].total += _count._all
      }

      if (kioskTown && counts.towns[kioskTown]) {
        counts.towns[kioskTown][type].total += _count._all

        if (status === "ACTIVE") {
          counts.towns[kioskTown][type].occupied += _count._all
        } 
        else if (["AVAILABLE", "REQUEST", "LOCALIZING", "UNACTIVE"].includes(status)) {
          counts.towns[kioskTown][type].available += _count._all
        } 
        else if (status === "IN_STOCK") {
          counts.towns[kioskTown][type].instock += _count._all
        } 
        else if (["ACTIVE_UNDER_MAINTENANCE", "UNACTIVE_UNDER_MAINTENANCE"].includes(status)) {
          counts.towns[kioskTown][type].underMaintenance += _count._all
        }
      }
    })

    // Process compartment counts globally
    compartmentCounts.forEach(({ status, _count }) => {
      if (counts.compartments[status] !== undefined) {
        counts.compartments[status] += _count._all
      }
    })
 
    // Calcul des statistiques des compartiments par ville pour les GRAND kiosques
    grandKiosksWithCompartments.forEach(kiosk => {
      if (kiosk.kioskType !== "GRAND") return

      const town = kiosk.kioskTown as keyof typeof counts.towns
      if (!town) return

      const compartments = kiosk.compartments;
      compartments.forEach(compartment => {
        if (compartment.status === "AVAILABLE") {
          counts.towns[town].GRAND.compartments.available++
        } else if (compartment.status === "OCCUPIED") {
          counts.towns[town].GRAND.compartments.occupied++
        } else if (compartment.status === "UNDER_MAINTENANCE") {
          counts.towns[town].GRAND.compartments.underMaintenance++
        }
      })
      
      counts.towns[town].GRAND.compartments.total = 
        counts.towns[town].GRAND.compartments.available +
        counts.towns[town].GRAND.compartments.occupied +
        counts.towns[town].GRAND.compartments.underMaintenance
    })

    // Métriques MONO globales
    const monoTotal = counts.kiosks.MONO.total || 0
    const monoOccupied = counts.kiosks.MONO.ACTIVE || 0
    const monoMaintenance = (counts.kiosks.MONO.ACTIVE_UNDER_MAINTENANCE || 0) + 
                            (counts.kiosks.MONO.UNACTIVE_UNDER_MAINTENANCE || 0)
    const monoInStock = counts.kiosks.MONO.IN_STOCK || 0
    const monoFree = (counts.kiosks.MONO.AVAILABLE || 0) + 
                     (counts.kiosks.MONO.REQUEST || 0) + 
                     (counts.kiosks.MONO.LOCALIZING || 0) + 
                     (counts.kiosks.MONO.UNACTIVE || 0)

    // Métriques GRAND globales
    const grandTotal = counts.kiosks.GRAND.total || 0
    const grandOccupied = counts.kiosks.GRAND.ACTIVE || 0
    const grandMaintenance = (counts.kiosks.GRAND.ACTIVE_UNDER_MAINTENANCE || 0) + 
                             (counts.kiosks.GRAND.UNACTIVE_UNDER_MAINTENANCE || 0)
    const grandInStock = counts.kiosks.GRAND.IN_STOCK || 0
    const grandFree = (counts.kiosks.GRAND.AVAILABLE || 0) + 
                      (counts.kiosks.GRAND.REQUEST || 0) + 
                      (counts.kiosks.GRAND.LOCALIZING || 0) + 
                      (counts.kiosks.GRAND.UNACTIVE || 0)

    // Métriques GRAND compartiments
    const grandCompartmentsTotal = grandTotal * 3
    const grandCompartmentsOccupied = counts.compartments.OCCUPIED || 0
    const grandCompartmentsFree = counts.compartments.AVAILABLE || 0
    const grandCompartmentsMaintenance = counts.compartments.UNDER_MAINTENANCE || 0

    const totalCompartments = monoTotal + grandCompartmentsTotal

    return {
      raw: counts,

      dashboard: {
        totalKiosks,
        kiosksAddedThisMonth,
        percentageAddedThisMonth,

        mono: {
          total: monoTotal,
          inStock: monoInStock,
          occupied: monoOccupied,
          free: monoFree,
          maintenance: monoMaintenance,
        },

        grand: {
          total: grandTotal,
          inStock: grandInStock,
          occupied: grandOccupied,
          free: grandFree,
          maintenance: grandMaintenance,
        },

        compartments: {
          total: grandCompartmentsTotal,
          occupied: grandCompartmentsOccupied,
          free: grandCompartmentsFree,
          maintenance: grandCompartmentsMaintenance,
        },

        totals: {
          totalCompartments: totalCompartments,
        },

        towns: {
          DOUALA: {
            MONO: {
              total: counts.towns.DOUALA.MONO.total || 0,
              available: counts.towns.DOUALA.MONO.available || 0,
              occupied: counts.towns.DOUALA.MONO.occupied || 0,
              maintenance: counts.towns.DOUALA.MONO.underMaintenance || 0,
              inStock: counts.towns.DOUALA.MONO.instock || 0,
            },
            GRAND: {
              total: counts.towns.DOUALA.GRAND.total || 0,
              free: counts.towns.DOUALA.GRAND.available || 0,
              occupied: counts.towns.DOUALA.GRAND.occupied || 0,
              maintenance: counts.towns.DOUALA.GRAND.underMaintenance || 0,
              inStock: counts.towns.DOUALA.GRAND.instock || 0,
              compartments: {
                free: counts.towns.DOUALA.GRAND.compartments.available || 0,
                occupied: counts.towns.DOUALA.GRAND.compartments.occupied || 0,
                maintenance: counts.towns.DOUALA.GRAND.compartments.underMaintenance || 0,
                total: counts.towns.DOUALA.GRAND.compartments.total || 0,
              }
            },
          },
          YAOUNDE: {
            MONO: {
              total: counts.towns.YAOUNDE.MONO.total || 0,
              available: counts.towns.YAOUNDE.MONO.available || 0,
              occupied: counts.towns.YAOUNDE.MONO.occupied || 0,
              maintenance: counts.towns.YAOUNDE.MONO.underMaintenance || 0,
              inStock: counts.towns.YAOUNDE.MONO.instock || 0,
            },
            GRAND: {
              total: counts.towns.YAOUNDE.GRAND.total || 0,
              free: counts.towns.YAOUNDE.GRAND.available || 0,
              occupied: counts.towns.YAOUNDE.GRAND.occupied || 0,
              maintenance: counts.towns.YAOUNDE.GRAND.underMaintenance || 0,
              inStock: counts.towns.YAOUNDE.GRAND.instock || 0,
              compartments: {
                free: counts.towns.YAOUNDE.GRAND.compartments.available || 0,
                occupied: counts.towns.YAOUNDE.GRAND.compartments.occupied || 0,
                maintenance: counts.towns.YAOUNDE.GRAND.compartments.underMaintenance || 0,
                total: counts.towns.YAOUNDE.GRAND.compartments.total || 0,
              }
            },
          },
        },
      },
    }
  } catch (error) {
    console.error("Error counting kiosks:", error)
    throw new Error("Une erreur est survenue lors du comptage des kiosques.")
  }
}

// Get kiosks with their compartments
export async function getKiosks({
  page = 1,
  limit = 100,
  searchTerm = "",
  status,
  date,
}: {
  page?: number
  limit?: number
  searchTerm?: string
  status?: KioskStatus | "all"
  date?: Date
}) {
  try {
    const where: any = {}

    if (searchTerm) {
      where.OR = [
        { kioskName: { contains: searchTerm, mode: "insensitive" } },
        { managerName: { contains: searchTerm, mode: "insensitive" } },
        { kioskAddress: { contains: searchTerm, mode: "insensitive" } },
      ]
    }

    if (status && status !== "all") {
      where.status = status
    }

    if (date) {
      where.createdAt = {
        gte: date,
        lt: new Date(date.getTime() + 24 * 60 * 60 * 1000),
      }
    }

    const [kiosks, totalCount] = await Promise.all([
      prisma.kiosk.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          compartments: {
            include: {
              client: {
                select: { id: true, name: true, email: true, phone: true}
              }
            }
          },
          monoClient: {
            select: { name: true, email: true }
          }
        },
      }),
      prisma.kiosk.count({ where }),
    ])

    return {
      kiosks,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    }
  } catch (error) {
    console.error("Error fetching kiosks:", error)
    throw new Error("Une erreur est survenue lors de la récupération des kiosques.")
  }
}

// Get user kiosks with compartments
export async function getUserKiosks({
  userId,
  page = 1,
  limit = 100,
  searchTerm = "",
  status,
  date,
}: {
  userId: string
  page?: number
  limit?: number
  searchTerm?: string
  status?: KioskStatus | "all"
  date?: Date
}) {
  try {
    const where: any = {
      assignments: {
        some: {
          userId: userId,
          isActive: true
        },
      },
    }

    if (searchTerm) {
      where.OR = [
        { kioskName: { contains: searchTerm, mode: "insensitive" } },
        { managerName: { contains: searchTerm, mode: "insensitive" } },
        { kioskAddress: { contains: searchTerm, mode: "insensitive" } },
      ]
    }

    if (status && status !== "all") {
      where.status = status
    }

    if (date) {
      where.createdAt = {
        gte: date,
        lt: new Date(date.getTime() + 24 * 60 * 60 * 1000),
      }
    }

    const [kiosks, totalCount] = await Promise.all([
      prisma.kiosk.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          compartments: {
            include: {
              client: {
                select: { name: true, email: true }
              }
            }
          },
          assignments: {
            where: { userId: userId },
            select: { role: true }
          }
        },
      }),
      prisma.kiosk.count({ where }),
    ])

    return {
      kiosks,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    }
  } catch (error) {
    console.error("Error fetching user kiosks:", error)
    throw new Error("Une erreur est survenue lors de la récupération des kiosques de l'utilisateur.")
  }
}


// Update kiosk with compartment support (pour MONO et GRAND)
export async function updateKiosk(kioskId: number, formData: any) {
  try {
    // Récupérer le kiosque existant avec ses informations
    const existingKiosk = await prisma.kiosk.findUnique({
      where: { id: kioskId },
      include: {
        compartments: true,
        monoClient: true,
      },
    })

    if (!existingKiosk) {
      return { error: "Kiosque non trouvé." }
    }

    const isMonoKiosk = existingKiosk.kioskType === "MONO"
    const oldUserId = existingKiosk.monoClientId
    const newUserId = formData.userId

    // Déterminer le nouveau statut pour MONO
    let newStatus = formData.status

    if (isMonoKiosk) {
      if (!oldUserId && newUserId) {
        newStatus = "ACTIVE"
      } else if (oldUserId && !newUserId) {
        const hasGpsCoordinates = existingKiosk.gpsLatitude && existingKiosk.gpsLongitude
        newStatus = hasGpsCoordinates ? "UNACTIVE" : "AVAILABLE"
      } else if (oldUserId && newUserId && oldUserId !== newUserId) {
        newStatus = "ACTIVE"
      } else {
        newStatus = formData.status || existingKiosk.status
      }
    }

    // Mettre à jour le kiosque
    const updatedKiosk = await prisma.kiosk.update({
      where: { id: kioskId },
      data: {
        kioskName: formData.kioskName,
        kioskAddress: formData.kioskAddress,
        gpsLatitude: formData.gpsLatitude ? parseFloat(formData.gpsLatitude) : null,
        gpsLongitude: formData.gpsLongitude ? parseFloat(formData.gpsLongitude) : null,
        productTypes: formData.productTypes,
        managerName: formData.managerName,
        managerContacts: formData.managerContacts,
        status: isMonoKiosk ? newStatus : formData.status,
        kioskTown: formData.kioskTown,
        monoClientId: isMonoKiosk ? (newUserId || null) : existingKiosk.monoClientId,
      },
    })

    // Gestion pour les kiosques MONO
    if (isMonoKiosk) {
      // Supprimer l'ancien assignment si existant
      if (oldUserId) {
        await prisma.kioskAssignment.deleteMany({
          where: {
            kioskId: kioskId,
            userId: oldUserId,
          },
        })
      }

      // Créer le nouvel assignment si nouveau client
      if (newUserId) {
        await prisma.kioskAssignment.create({
          data: {
            kioskId: kioskId,
            userId: newUserId,
            role: "CLIENT",
            assignedBy: newUserId,
            isActive: true,
          },
        })
      }

      // Mettre à jour le compartiment MONO
      const monoCompartment = existingKiosk.compartments.find(c => c.compartmentType === "SINGLE")
      if (monoCompartment) {
        await prisma.kioskCompartment.update({
          where: { id: monoCompartment.id },
          data: {
            clientId: newUserId || null,
            status: newUserId ? "OCCUPIED" : "AVAILABLE",
            assignedAt: newUserId ? new Date() : null,
            assignedBy: newUserId ? newUserId : null,
          },
        })
      }
    }

    // Gestion pour les kiosques GRAND - Mise à jour des compartiments
    if (!isMonoKiosk && formData.compartments) {
      const compartmentsData = formData.compartments
      
      for (const compartment of existingKiosk.compartments) {
        let newCompartmentStatus = compartment.status
        let newClientId = compartment.clientId
        
        if (compartment.compartmentType === "LEFT" && compartmentsData.left) {
          newCompartmentStatus = compartmentsData.left.status || "AVAILABLE"
          newClientId = compartmentsData.left.clientId || null
        } else if (compartment.compartmentType === "MIDDLE" && compartmentsData.middle) {
          newCompartmentStatus = compartmentsData.middle.status || "AVAILABLE"
          newClientId = compartmentsData.middle.clientId || null
        } else if (compartment.compartmentType === "RIGHT" && compartmentsData.right) {
          newCompartmentStatus = compartmentsData.right.status || "AVAILABLE"
          newClientId = compartmentsData.right.clientId || null
        }
        
        await prisma.kioskCompartment.update({
          where: { id: compartment.id },
          data: {
            status: newCompartmentStatus,
            clientId: newClientId,
            assignedAt: newClientId ? new Date() : null,
            assignedBy: newClientId ? formData.userId || "admin" : null,
          },
        })
      }
    }

    return { message: "Kiosque modifié avec succès!", kiosk: updatedKiosk }
  } catch (error) {
    console.error("Error updating kiosk:", error)
    return { error: "Une erreur est survenue lors de la modification du kiosque." }
  }
}

// Update compartment status and client
export async function updateCompartment(
  compartmentId: number,
  data: { status?: CompartmentStatus; clientId?: string | null }
) {
  try {
    const updatedCompartment = await prisma.kioskCompartment.update({
      where: { id: compartmentId },
      data: {
        status: data.status,
        clientId: data.clientId,
        assignedAt: data.clientId ? new Date() : undefined,
        assignedBy: data.clientId ? "system" : undefined
      },
      include: {
        client: true,
        kiosk: true
      }
    })

    return { message: "Compartiment mis à jour avec succès!", compartment: updatedCompartment }
  } catch (error) {
    console.error("Error updating compartment:", error)
    return { error: "Une erreur est survenue lors de la mise à jour du compartiment." }
  }
}

// Delete kiosk with cascade (compartments will be auto-deleted)
export async function deleteKiosk(kioskId: number) {
  try {
    // Delete assignments first (they cascade, but explicit for safety)
    await prisma.kioskAssignment.deleteMany({
      where: { kioskId: kioskId },
    })

    // Delete the kiosk (compartments cascade delete)
    const deletedKiosk = await prisma.kiosk.delete({
      where: { id: kioskId },
    })

    return { message: "Kiosque supprimé avec succès!", kiosk: deletedKiosk }
  } catch (error) {
    console.error("Error deleting kiosk:", error)
    return { error: "Une erreur est survenue lors de la suppression du kiosque." }
  }
}

// Keep existing helper functions (update as needed)
export async function getKiosksForTicket() {
  const kiosks = await prisma.kiosk.findMany({
    select: {
      id: true,
      kioskName: true,
    },
  })
  return kiosks
}

export async function getUserKiosksForTicket(userId: string) {
  const userKiosks = await prisma.kioskAssignment.findMany({
    where: {
      userId: userId,
      isActive: true
    },
    select: {
      kiosk: {
        select: {
          id: true,
          kioskName: true,
        }
      }
    },
  })

  return userKiosks.map(uk => uk.kiosk)
}

export async function getKiosksWithCoordinates() {
  try {
    const kiosks = await prisma.kiosk.findMany({
      where: {
        gpsLatitude: { not: null },
        gpsLongitude: { not: null },
      },
      include: {
        compartments: {
          where: { status: "OCCUPIED" },
          include: { client: true }
        }
      }
    })

    return kiosks.map(kiosk => ({
      id: kiosk.id.toString(),
      position: {
        lat: kiosk.gpsLatitude!,
        lng: kiosk.gpsLongitude!,
      },
      title: kiosk.kioskName,
      type: kiosk.kioskType,
      compartments: kiosk.compartments.length,
      occupiedCompartments: kiosk.compartments.filter(c => c.status === "OCCUPIED").length,
      location: kiosk.kioskAddress || 'Non spécifié',
      coordinates: `${kiosk.gpsLatitude}, ${kiosk.gpsLongitude}`,
      revenue: kiosk.averageMonthlyRevenue ?
        `${kiosk.averageMonthlyRevenue.toLocaleString()} CFA` :
        'Non spécifié',
    }))
  } catch (error) {
    console.error("Error fetching kiosks with coordinates:", error)
    throw new Error("Failed to fetch kiosks with coordinates")
  }
}

// Add this to your kiosk-actions.ts file

export async function getUserKioskCounts(userId: string) {
  try {
    // Get all kiosk assignments for this user
    const userAssignments = await prisma.kioskAssignment.findMany({
      where: {
        userId: userId,
        isActive: true,
      },
      select: {
        kioskId: true,
      },
    })

    const kioskIds = userAssignments.map(assignment => assignment.kioskId)

    if (kioskIds.length === 0) {
      return {
        totalKiosks: 0,
        oneCompartment: {
          REQUEST: 0,
          LOCALIZING: 0,
          AVAILABLE: 0,
          UNDER_MAINTENANCE: 0,
        },
        threeCompartment: {
          REQUEST: 0,
          LOCALIZING: 0,
          AVAILABLE: 0,
          UNDER_MAINTENANCE: 0,
        },
      }
    }

    // Get kiosks with their compartments
    const kiosks = await prisma.kiosk.findMany({
      where: {
        id: { in: kioskIds },
      },
      include: {
        compartments: {
          select: {
            compartmentType: true,
            status: true,
          },
        },
      },
    })

    // Initialize counts
    const counts = {
      totalKiosks: kiosks.length,
      oneCompartment: {
        REQUEST: 0,
        LOCALIZING: 0,
        AVAILABLE: 0,
        UNDER_MAINTENANCE: 0,
      },
      threeCompartment: {
        REQUEST: 0,
        LOCALIZING: 0,
        AVAILABLE: 0,
        UNDER_MAINTENANCE: 0,
      },
    }

    // Process each kiosk
    for (const kiosk of kiosks) {
      const kioskStatus = kiosk.status
      const isGrandKiosk = kiosk.kioskType === "GRAND"

      // For MONO kiosks, count the kiosk itself
      if (!isGrandKiosk) {
        if (counts.oneCompartment[kioskStatus] !== undefined) {
          counts.oneCompartment[kioskStatus]++
        }
      }

      // For GRAND kiosks, count individual compartments
      if (isGrandKiosk && kiosk.compartments) {
        for (const compartment of kiosk.compartments) {
          const compartmentStatus = compartment.status
          if (counts.threeCompartment[compartmentStatus] !== undefined) {
            counts.threeCompartment[compartmentStatus]++
          }
        }
      }
    }

    return counts
  } catch (error) {
    console.error("Error counting user kiosks:", error)
    throw new Error("Une erreur est survenue lors du comptage des kiosques de l'utilisateur.")
  }
}

// Add this to your kiosk-actions.ts file

type KioskRequestData = {
  kioskName: string
  kioskAddress: string
  kioskType: KioskType
  productTypes?: string
  managerName?: string
  managerContacts?: string
  userId: string
  clientName: string
  compartments?: string
  wantBranding: boolean
}

export async function addKioskByClient(formData: FormData) {
  const requestData: KioskRequestData = {
    kioskName: formData.get("kioskName") as string,
    kioskAddress: formData.get("kioskAddress") as string,
    kioskType: formData.get("kioskType") as KioskType,
    productTypes: formData.get("productsServices") as string,
    managerName: formData.get("managerName") as string,
    managerContacts: formData.get("managerContact") as string,
    userId: formData.get("userId") as string,
    clientName: formData.get("clientName") as string,
    compartments: formData.get("compartments") as string,
    wantBranding: formData.get("wantBranding") === "true",
  }

  try {
    // Validate required fields
    if (!requestData.kioskName || !requestData.kioskAddress || !requestData.userId) {
      return { error: "Veuillez remplir tous les champs obligatoires." }
    }

    if (!requestData.kioskType) {
      return { error: "Veuillez sélectionner un type de kiosque." }
    }

    // Parse compartments if GRAND kiosk
    let selectedCompartments = null
    if (requestData.kioskType === "GRAND" && requestData.compartments) {
      selectedCompartments = JSON.parse(requestData.compartments)
      const hasAtLeastOne = selectedCompartments.left || selectedCompartments.middle || selectedCompartments.right
      if (!hasAtLeastOne) {
        return { error: "Veuillez sélectionner au moins un compartiment." }
      }
    }

    // Get client email
    const client = await prisma.user.findUnique({
      where: { id: requestData.userId },
      select: { email: true, phone: true }
    })

    // Generate request number
    const requestNumber = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    // Create the request
    const kioskRequest = await prisma.kioskRequest.create({
      data: {
        requestNumber,
        requestType: "NEW_KIOSK",
        status: "PENDING",
        clientId: requestData.userId,
        clientName: requestData.clientName,
        clientEmail: client?.email,
        clientPhone: client?.phone,
        requestedKioskType: requestData.kioskType,
        requestedCompartments: selectedCompartments,
        wantBranding: requestData.wantBranding,
        kioskAddress: requestData.kioskAddress,
        productTypes: requestData.productTypes,
        managerName: requestData.managerName,
        managerContacts: requestData.managerContacts,
        notes: `Demande de kiosque ${requestData.kioskType} à ${requestData.kioskAddress}`,
      },
    })

    // Find and reserve available kiosks/compartments
    let assignedKioskId = null
    if (requestData.kioskType === "MONO") {
      const availableKiosk = await prisma.kiosk.findFirst({
        where: {
          kioskType: "MONO",
          status: "AVAILABLE",
        },
        include: {
          compartments: true,
        },
      })

      if (availableKiosk) {
        assignedKioskId = availableKiosk.id
        await prisma.kiosk.update({
          where: { id: availableKiosk.id },
          data: { status: "REQUEST" },
        })
        await prisma.kioskCompartment.updateMany({
          where: { kioskId: availableKiosk.id, compartmentType: "SINGLE" },
          data: { status: "RESERVED" },
        })
      }
    } else if (requestData.kioskType === "GRAND" && selectedCompartments) {
      const requestedCompartmentsList = []
      if (selectedCompartments.left) requestedCompartmentsList.push("LEFT")
      if (selectedCompartments.middle) requestedCompartmentsList.push("MIDDLE")
      if (selectedCompartments.right) requestedCompartmentsList.push("RIGHT")

      const availableKiosk = await prisma.kiosk.findFirst({
        where: {
          kioskType: "GRAND",
          status: "AVAILABLE",
          compartments: {
            some: {
              compartmentType: { in: requestedCompartmentsList as any },
              status: "AVAILABLE",
            },
          },
        },
        include: {
          compartments: true,
        },
      })

      if (availableKiosk) {
        assignedKioskId = availableKiosk.id
        await prisma.kiosk.update({
          where: { id: availableKiosk.id },
          data: { status: "REQUEST" },
        })

        for (const compartment of availableKiosk.compartments) {
          const shouldUpdate =
            (compartment.compartmentType === "LEFT" && selectedCompartments.left) ||
            (compartment.compartmentType === "MIDDLE" && selectedCompartments.middle) ||
            (compartment.compartmentType === "RIGHT" && selectedCompartments.right)

          if (shouldUpdate) {
            await prisma.kioskCompartment.update({
              where: { id: compartment.id },
              data: { status: "RESERVED" },
            })
          }
        }
      }
    }

    if (assignedKioskId) {
      await prisma.kioskRequest.update({
        where: { id: kioskRequest.id },
        data: { assignedKioskId: assignedKioskId },
      })
    }

    // Prepare compartment text for email
    let compartmentText = "N/A"
    if (selectedCompartments) {
      const selected = []
      if (selectedCompartments.left) selected.push("Gauche")
      if (selectedCompartments.middle) selected.push("Centre")
      if (selectedCompartments.right) selected.push("Droit")
      compartmentText = selected.join(", ")
    }

    // Prepare branding text
    const brandingText = requestData.wantBranding
      ? `<p><strong>🎨 Personnalisation demandée :</strong> Oui (logo, couleurs personnalisées, enseigne lumineuse)</p>`
      : `<p><strong>🎨 Personnalisation demandée :</strong> Non</p>`

    // Fetch all users with RESPONSABLEKIOSK, ADMIN, and COMMERCIAL roles
    const staffUsers = await prisma.user.findMany({
      where: {
        role: {
          in: [Role.RESPONSABLEKIOSK, Role.ADMIN, Role.COMMERCIAL],
        },
      },
    })

    // Email content for staff
    const kioskDetails = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ff6b4a;">📋 Nouvelle demande de kiosque</h2>
        <p><strong>Numéro de demande :</strong> ${kioskRequest.requestNumber}</p>
        <p><strong>Client :</strong> ${requestData.clientName}</p>
        <p><strong>Email :</strong> ${client?.email || "Non renseigné"}</p>
        <p><strong>Téléphone :</strong> ${client?.phone || "Non renseigné"}</p>
        <hr />
        <p><strong>🏪 Type de kiosque :</strong> ${requestData.kioskType === "MONO" ? "MONO (1 compartiment)" : "GRAND (3 compartiments)"}</p>
        ${requestData.kioskType === "GRAND" ? `<p><strong>📦 Compartiments demandés :</strong> ${compartmentText}</p>` : ""}
        ${brandingText}
        <p><strong>📍 Adresse :</strong> ${requestData.kioskAddress}</p>
        <p><strong>🛍️ Produits/Services :</strong> ${requestData.productTypes || "Non spécifié"}</p>
        <p><strong>👨‍💼 Gestionnaire :</strong> ${requestData.managerName || "Non spécifié"}</p>
        <p><strong>📞 Contact gestionnaire :</strong> ${requestData.managerContacts || "Non spécifié"}</p>
        <hr />
        <p><strong>✅ Prochaines étapes :</strong></p>
        <ul>
          <li>Contacter le client pour confirmer la demande</li>
          <li>Préparer une proforma avec le détail des prix</li>
          ${requestData.wantBranding ? '<li>Inclure les options de personnalisation (logo, couleurs, enseigne)</li>' : ''}
          <li>Planifier l'installation du kiosque</li>
        </ul>
        <p style="margin-top: 20px; font-size: 12px; color: #666;">
          Connectez-vous au panneau d'administration pour traiter cette demande.
        </p>
      </div>
    `

    // Send email to all responsible staff (RESPONSABLEKIOSK, ADMIN, COMMERCIAL)
    await sendStaffNotificationIndividual(
      staffUsers.map((user) => user.email),
      kioskDetails,
    )

    return {
      message: "Votre demande a été enregistrée! Un commercial vous contactera sous 48h avec une proforma détaillée.",
      request: kioskRequest,
    }
  } catch (error) {
    console.error("Error creating kiosk request:", error)
    return { error: "Une erreur est survenue lors de la soumission de votre demande." }
  }
}

// Admin function to approve a request and update kiosk status
export async function approveKioskRequest(requestId: string, adminId: string) {
  try {
    const request = await prisma.kioskRequest.findUnique({
      where: { id: requestId },
      include: { assignedKiosk: true },
    })

    if (!request) {
      return { error: "Demande non trouvée" }
    }

    // Update the kiosk status from REQUEST to OCCUPIED/ACTIVE
    if (request.assignedKioskId) {
      await prisma.kiosk.update({
        where: { id: request.assignedKioskId },
        data: { status: "ACTIVE" },
      })

      // Update compartments to OCCUPIED
      await prisma.kioskCompartment.updateMany({
        where: { kioskId: request.assignedKioskId },
        data: {
          status: "OCCUPIED",
          clientId: request.clientId,
          assignedAt: new Date(),
          assignedBy: adminId,
        },
      })
    }

    // Update request status
    await prisma.kioskRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        processedAt: new Date(),
        processedBy: adminId,
        adminNotes: "Demande approuvée par l'administrateur",
      },
    })

    // Notify client
    if (request.clientEmail) {
      await sendClientNotification(
        request.clientEmail,
        request.requestNumber,
        "approved"
      )
    }

    return { message: "Demande approuvée avec succès" }
  } catch (error) {
    console.error("Error approving request:", error)
    return { error: "Une erreur est survenue lors de l'approbation." }
  }
}

// Admin function to reject a request
export async function rejectKioskRequest(requestId: string, adminId: string, reason: string) {
  try {
    const request = await prisma.kioskRequest.findUnique({
      where: { id: requestId },
    })

    if (!request) {
      return { error: "Demande non trouvée" }
    }

    // Free up any reserved kiosk/compartments
    if (request.assignedKioskId) {
      await prisma.kiosk.update({
        where: { id: request.assignedKioskId },
        data: { status: "AVAILABLE" },
      })

      await prisma.kioskCompartment.updateMany({
        where: { kioskId: request.assignedKioskId },
        data: { status: "AVAILABLE", clientId: null },
      })
    }

    // Update request status
    await prisma.kioskRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        processedAt: new Date(),
        processedBy: adminId,
        adminNotes: reason,
      },
    })

    // Notify client
    if (request.clientEmail) {
      await sendClientNotification(
        request.clientEmail,
        request.requestNumber,
        "rejected",
        reason
      )
    }

    return { message: "Demande rejetée" }
  } catch (error) {
    console.error("Error rejecting request:", error)
    return { error: "Une erreur est survenue lors du rejet." }
  }
}

// Get all requests for admin
export async function getKioskRequests({
  page = 1,
  limit = 50,
  status,
}: {
  page?: number
  limit?: number
  status?: RequestStatus | "all"
}) {
  try {
    const where: any = {}
    if (status && status !== "all") {
      where.status = status
    }

    const [requests, totalCount] = await Promise.all([
      prisma.kioskRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          client: {
            select: { name: true, email: true, phone: true },
          },
          assignedKiosk: {
            select: { id: true, kioskName: true, kioskMatricule: true },
          },
        },
      }),
      prisma.kioskRequest.count({ where }),
    ])

    return {
      requests,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    }
  } catch (error) {
    console.error("Error fetching requests:", error)
    throw new Error("Une erreur est survenue lors de la récupération des demandes.")
  }
}

// Get requests for a specific client
export async function getUserKioskRequests(userId: string) {
  try {
    const requests = await prisma.kioskRequest.findMany({
      where: { clientId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        assignedKiosk: {
          select: { id: true, kioskName: true, kioskMatricule: true },
        },
      },
    })

    return { success: true, requests }
  } catch (error) {
    console.error("Error fetching user requests:", error)
    return { error: "Une erreur est survenue." }
  }
}

// Get all requests for admin dashboard
export async function getAllKioskRequests({
  page = 1,
  limit = 50,
  status,
}: {
  page?: number
  limit?: number
  status?: string
}) {
  try {
    const where: any = {}
    if (status && status !== "all") {
      where.status = status
    }

    const [requests, totalCount] = await Promise.all([
      prisma.kioskRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          requestNumber: true,
          status: true,
          requestedKioskType: true,
          requestedCompartments: true,
          wantBranding: true,
          kioskAddress: true,
          createdAt: true,
          clientName: true,
          clientEmail: true,
        },
      }),
      prisma.kioskRequest.count({ where }),
    ])

    return {
      requests,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    }
  } catch (error) {
    console.error("Error fetching requests:", error)
    return { requests: [], totalCount: 0, totalPages: 0 }
  }
}