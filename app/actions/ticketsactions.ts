"use server"

import { PrismaClient, RequestStatus, type RequestPriority } from "@prisma/client"

const prisma = new PrismaClient()

export async function createServiceRequest(formData: {
  kioskId: number
  technicians: string[]
  problemDescription: string
  comments?: string
  priority: RequestPriority
  resolvedDate?: string
  attachments?: string[]
}) {

  console.log(formData);
  try {
    const newServiceRequest = await prisma.serviceRequest.create({
      data: {
        kiosk: { connect: { id: formData.kioskId } },
        technicians: {
          connect: formData.technicians.map((id) => ({ id })),
        },
        problemDescription: formData.problemDescription,
        comments: formData.comments,
        priority: formData.priority,
        resolvedDate: formData.resolvedDate ? new Date(formData.resolvedDate) : null,
        attachments: formData.attachments ? formData.attachments.join(",") : null,
        status: RequestStatus.OPEN,
      },
    })

    // Update kiosk status to UNDER_MAINTENANCE
    await prisma.kiosk.update({
      where: { id: formData.kioskId },
      data: { status: "UNDER_MAINTENANCE" },
    })

    return newServiceRequest
  } catch (error) {
    console.error("Error creating service request:", error)
    throw new Error("Failed to create service request")
  }
}

export async function getServiceRequests() {
  try {
    const serviceRequests = await prisma.serviceRequest.findMany({
      include: {
        kiosk: true,
        technicians: true,
      },
    })
    return serviceRequests
  } catch (error) {
    console.error("Error fetching service requests:", error)
    throw new Error("Failed to fetch service requests")
  }
}


export async function getMaintenanceMetrics() {
  const totalKiosks = await prisma.kiosk.count({
    where: { status: "UNDER_MAINTENANCE" },
  })

  const totalTickets = await prisma.serviceRequest.count()

  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const openTicketsThisMonth = await prisma.serviceRequest.count({
    where: {
      createdDate: { gte: firstDayOfMonth },
      status: "OPEN",
    },
  })

  const completedTicketsThisMonth = await prisma.serviceRequest.count({
    where: {
      resolvedDate: { gte: firstDayOfMonth },
      status: "CLOSED",
    },
  })

  return {
    kiosksInMaintenance: totalKiosks,
    totalTickets,
    openTicketsThisMonth,
    completedTicketsThisMonth,
  }
}

export async function getMaintenanceTickets({
  page = 1,
  limit = 10,
  searchTerm = "",
  status,
  startDate,
  endDate,
}: {
  page?: number
  limit?: number
  searchTerm?: string
  status?: RequestStatus
  startDate?: Date
  endDate?: Date
}) {
  const where: any = {}

  if (searchTerm) {
    where.OR = [
      { id: { contains: searchTerm } },
      { kiosk: { kioskName: { contains: searchTerm } } },
      { technicians: { some: { name: { contains: searchTerm } } } },
    ]
  }

  if (status) {
    where.status = status
  }

  if (startDate) {
    where.createdDate = { gte: startDate }
  }

  if (endDate) {
    where.createdDate = { ...where.createdDate, lte: endDate }
  }

  const [tickets, totalCount] = await Promise.all([
    prisma.serviceRequest.findMany({
      where,
      include: {
        kiosk: true,
        technicians: true,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdDate: "desc" },
    }),
    prisma.serviceRequest.count({ where }),
  ])

  return {
    tickets,
    totalPages: Math.ceil(totalCount / limit),
    totalCount,
  }
}

export async function deleteTickets(ticketIds: string[]) {
  await prisma.serviceRequest.deleteMany({
    where: {
      id: { in: ticketIds },
    },
  })
}

