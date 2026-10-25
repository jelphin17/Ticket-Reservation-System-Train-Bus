// LocalStorage Manager for Persistent Bookings and State

const STORAGE_KEYS = {
  BOOKINGS: 'transithub_bookings_v1',
  ACTIVE_SEARCH: 'transithub_active_search',
  THEME: 'transithub_theme_mode'
};

const SAMPLE_BOOKINGS = [
  {
    pnr: 'TRN-884920',
    bookingId: 'BK-TRN-9021',
    mode: 'train',
    bookedAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    travelDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0],
    service: {
      id: 'TRN-101',
      number: '20101',
      name: 'Acela Hyperion Express',
      type: 'Bullet / High Speed',
      from: 'NYC',
      to: 'WAS',
      fromStation: 'New York (Penn Station)',
      toStation: 'Washington D.C. (Union Station)',
      departure: '06:15',
      arrival: '09:10',
      duration: '2h 55m',
      platform: 'Track 4B',
      coach: 'Coach B2',
      classCode: '2A',
      className: '2-Tier AC Sleeper'
    },
    passengers: [
      { name: 'Alex Johnson', age: 29, gender: 'Male', seat: 'B2-14', berth: 'Lower Berth (LB)', meal: 'Vegetarian' },
      { name: 'Sarah Johnson', age: 28, gender: 'Female', seat: 'B2-15', berth: 'Window Berth (SL)', meal: 'Continental' }
    ],
    seats: ['B2-14', 'B2-15'],
    fare: {
      baseFare: 163.2,
      taxes: 19.58,
      insurance: 4.0,
      discount: 20.0,
      totalPaid: 166.78,
      couponCode: 'FIRSTBOOK',
      paymentMethod: 'Credit Card (•••• 4242)'
    },
    contact: {
      email: 'alex.johnson@example.com',
      phone: '+1 (555) 382-9910'
    },
    status: 'CONFIRMED'
  },
  {
    pnr: 'BUS-621840',
    bookingId: 'BK-BUS-4491',
    mode: 'bus',
    bookedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    travelDate: new Date(Date.now() + 48 * 3600 * 1000).toISOString().split('T')[0],
    service: {
      id: 'BUS-201',
      number: 'OB-9801',
      name: 'OmniBus Black Diamond',
      type: 'Volvo 9600 Multi-Axle AC Sleeper (2+1)',
      from: 'NYC',
      to: 'WAS',
      fromStation: 'Port Authority Bay 18',
      toStation: 'Union Station Bus Deck',
      departure: '07:00',
      arrival: '11:20',
      duration: '4h 20m',
      platform: 'Bay 18',
      deck: 'Upper Deck',
      classCode: 'VOLVO_MULTI',
      className: 'Volvo Luxury Sleeper'
    },
    passengers: [
      { name: 'Morgan Vance', age: 34, gender: 'Non-binary', seat: 'U07', berth: 'Upper Sleeper Single', meal: 'None' }
    ],
    seats: ['U07'],
    fare: {
      baseFare: 51.0,
      taxes: 6.12,
      insurance: 2.0,
      discount: 7.65,
      totalPaid: 51.47,
      couponCode: 'SUPERTRIP',
      paymentMethod: 'Instant UPI / QR'
    },
    contact: {
      email: 'morgan.vance@workmail.com',
      phone: '+1 (555) 712-4091'
    },
    status: 'CONFIRMED'
  }
];

export const storage = {
  getBookings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(SAMPLE_BOOKINGS));
        return SAMPLE_BOOKINGS;
      }
      return JSON.parse(data);
    } catch (e) {
      return SAMPLE_BOOKINGS;
    }
  },

  saveBooking(booking) {
    const list = this.getBookings();
    list.unshift(booking);
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(list));
    return booking;
  },

  getBookingByPnr(pnr) {
    if (!pnr) return null;
    const clean = pnr.trim().toUpperCase();
    const list = this.getBookings();
    return list.find(b => b.pnr.toUpperCase() === clean) || null;
  },

  cancelBooking(pnr, reason = 'Passenger requested cancellation') {
    const list = this.getBookings();
    const booking = list.find(b => b.pnr.toUpperCase() === pnr.toUpperCase());
    if (!booking) return { success: false, message: 'PNR not found.' };

    if (booking.status === 'CANCELLED') {
      return { success: false, message: 'Booking is already cancelled.' };
    }

    const refundPercentage = 0.85; // 85% refund policy
    const refundAmount = +(booking.fare.totalPaid * refundPercentage).toFixed(2);
    const cancellationFee = +(booking.fare.totalPaid - refundAmount).toFixed(2);

    booking.status = 'CANCELLED';
    booking.cancellation = {
      cancelledAt: new Date().toISOString(),
      reason,
      refundAmount,
      cancellationFee,
      refundStatus: 'INITIATED - Arriving in 2-4 business days'
    };

    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(list));
    return { success: true, booking, refundAmount, cancellationFee };
  },

  deleteBooking(pnr) {
    let list = this.getBookings();
    list = list.filter(b => b.pnr.toUpperCase() !== pnr.toUpperCase());
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(list));
  },

  getActiveSearch() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_SEARCH);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  saveActiveSearch(searchParams) {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SEARCH, JSON.stringify(searchParams));
    } catch (e) {}
  },

  getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
  },

  setTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }
};
