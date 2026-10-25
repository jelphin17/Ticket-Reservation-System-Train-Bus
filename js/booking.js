// Passenger Details, Add-ons, Coupon Engine, and Fare Calculation
import { COUPONS } from './data.js';
import { sfx } from './audio.js';

export class BookingManager {
  constructor(options = {}) {
    this.service = null;
    this.selectedSeats = [];
    this.selectedClass = null;
    this.travelDate = null;
    this.appliedCoupon = null;
    this.addons = {
      insurance: true, // Default recommended
      carbonOffset: false,
      gourmetMeal: false
    };
    this.passengers = [];
    this.contact = {
      email: '',
      phone: ''
    };
    this.onFareUpdated = options.onFareUpdated || (() => {});
  }

  setBookingContext(service, chosenClass, travelDate, seats) {
    this.service = service;
    this.selectedClass = chosenClass;
    this.travelDate = travelDate || new Date().toISOString().split('T')[0];
    this.updateSeats(seats);
  }

  updateSeats(seats) {
    this.selectedSeats = seats;
    // Align passengers array to match number of seats
    const newPassengers = [];
    seats.forEach((seat, i) => {
      const existing = this.passengers[i] || {};
      newPassengers.push({
        seatId: seat.id,
        seatLabel: seat.label,
        berthType: seat.berthType,
        price: seat.price,
        name: existing.name || '',
        age: existing.age || '',
        gender: existing.gender || 'Male',
        meal: existing.meal || 'Vegetarian'
      });
    });
    this.passengers = newPassengers;
    this.recalculateFare();
  }

  setAddon(key, val) {
    this.addons[key] = val;
    this.recalculateFare();
  }

  applyCoupon(code) {
    if (!code) return { success: false, message: 'Please enter a valid coupon code.' };
    const clean = code.trim().toUpperCase();
    const found = COUPONS.find(c => c.code === clean);

    if (!found) {
      sfx.playError();
      return { success: false, message: 'Invalid promo code. Try SUPERTRIP or FIRSTBOOK.' };
    }

    const fare = this.calculateRawFare();
    if (found.minAmount && fare.baseSeatsTotal < found.minAmount) {
      sfx.playError();
      return { success: false, message: `Coupon requires a minimum fare of $${found.minAmount}. Current base fare is $${fare.baseSeatsTotal}.` };
    }

    this.appliedCoupon = found;
    sfx.playSuccess();
    this.recalculateFare();
    return { success: true, message: `Awesome! Coupon "${found.code}" applied successfully.`, coupon: found };
  }

  removeCoupon() {
    this.appliedCoupon = null;
    this.recalculateFare();
  }

  calculateRawFare() {
    const seatCount = this.selectedSeats.length;
    const baseSeatsTotal = this.selectedSeats.reduce((sum, s) => sum + (s.price || 0), 0);

    // Taxes & Convenience Fee (8% tax + $3 flat booking fee)
    const taxes = seatCount > 0 ? +(baseSeatsTotal * 0.08).toFixed(2) : 0;
    const convenienceFee = seatCount > 0 ? 3.50 : 0;

    // Addons
    let insuranceTotal = 0;
    if (this.addons.insurance && seatCount > 0) {
      insuranceTotal = +(seatCount * 2.50).toFixed(2);
    }

    let carbonTotal = 0;
    if (this.addons.carbonOffset && seatCount > 0) {
      carbonTotal = +(seatCount * 1.00).toFixed(2);
    }

    let mealTotal = 0;
    if (this.addons.gourmetMeal && seatCount > 0) {
      mealTotal = +(seatCount * 8.50).toFixed(2);
    }

    const subtotal = +(baseSeatsTotal + taxes + convenienceFee + insuranceTotal + carbonTotal + mealTotal).toFixed(2);

    // Discount
    let discount = 0;
    if (this.appliedCoupon) {
      if (this.appliedCoupon.discountPercent) {
        discount = (baseSeatsTotal * (this.appliedCoupon.discountPercent / 100));
        if (this.appliedCoupon.maxDiscount && discount > this.appliedCoupon.maxDiscount) {
          discount = this.appliedCoupon.maxDiscount;
        }
      } else if (this.appliedCoupon.flatDiscount) {
        discount = this.appliedCoupon.flatDiscount;
      }
      discount = Math.min(discount, subtotal);
      discount = +discount.toFixed(2);
    }

    const grandTotal = Math.max(0, +(subtotal - discount).toFixed(2));

    return {
      seatCount,
      baseSeatsTotal,
      taxes,
      convenienceFee,
      insuranceTotal,
      carbonTotal,
      mealTotal,
      discount,
      grandTotal,
      couponCode: this.appliedCoupon ? this.appliedCoupon.code : null
    };
  }

  recalculateFare() {
    const breakdown = this.calculateRawFare();
    this.onFareUpdated(breakdown);
    return breakdown;
  }

  validatePassengerDetails() {
    if (this.selectedSeats.length === 0) {
      return { valid: false, message: 'Please select at least 1 seat to proceed.' };
    }

    for (let i = 0; i < this.passengers.length; i++) {
      const p = this.passengers[i];
      if (!p.name || p.name.trim().length < 2) {
        return { valid: false, message: `Please enter a valid full name for Passenger ${i + 1} (Seat ${p.seatLabel}).` };
      }
      const ageNum = parseInt(p.age, 10);
      if (!ageNum || isNaN(ageNum) || ageNum < 1 || ageNum > 115) {
        return { valid: false, message: `Please enter a valid age (1-115) for Passenger ${i + 1} (${p.name}).` };
      }
    }

    if (!this.contact.email || !this.contact.email.includes('@') || !this.contact.email.includes('.')) {
      return { valid: false, message: 'Please enter a valid email address to receive your e-ticket & updates.' };
    }

    if (!this.contact.phone || this.contact.phone.trim().length < 7) {
      return { valid: false, message: 'Please enter a valid mobile number for trip SMS alerts.' };
    }

    return { valid: true };
  }

  generateBookingPayload(paymentDetails) {
    const fare = this.calculateRawFare();
    const mode = this.service.mode || 'train';
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const pnrPrefix = mode === 'train' ? 'TRN' : 'BUS';
    const pnr = `${pnrPrefix}-${randomDigits}`;
    const bookingId = `BK-${pnrPrefix}-${Date.now().toString().slice(-6)}`;

    return {
      pnr,
      bookingId,
      mode,
      bookedAt: new Date().toISOString(),
      travelDate: this.travelDate,
      service: {
        id: this.service.id,
        number: this.service.number,
        name: this.service.name || this.service.operator,
        type: this.service.typeName || this.service.type,
        from: this.service.from,
        to: this.service.to,
        fromStation: this.service.fromStation || this.service.stops?.[0] || this.service.boardingPoints?.[0] || this.service.from,
        toStation: this.service.toStation || this.service.stops?.[this.service.stops.length - 1] || this.service.droppingPoints?.[0] || this.service.to,
        departure: this.service.departure,
        arrival: this.service.arrival,
        duration: this.service.duration,
        platform: this.service.platform || this.service.boardingPoints?.[0] || 'Platform 1',
        coach: mode === 'train' ? (this.selectedSeats[0]?.id?.split('-')[0] || 'Coach B1') : 'Deck A',
        classCode: this.selectedClass || 'SL',
        className: (window.TRAIN_CLASSES_REF && window.TRAIN_CLASSES_REF[this.selectedClass]?.name) || this.service.typeName || 'Standard'
      },
      passengers: this.passengers.map(p => ({
        name: p.name.trim(),
        age: parseInt(p.age, 10),
        gender: p.gender,
        seat: p.seatLabel,
        berth: p.berthType,
        meal: p.meal
      })),
      seats: this.selectedSeats.map(s => s.label),
      fare: {
        baseFare: fare.baseSeatsTotal,
        taxes: fare.taxes,
        convenienceFee: fare.convenienceFee,
        insurance: fare.insuranceTotal,
        carbonOffset: fare.carbonTotal,
        gourmetMeal: fare.mealTotal,
        discount: fare.discount,
        totalPaid: fare.grandTotal,
        couponCode: fare.couponCode,
        paymentMethod: paymentDetails.methodSummary
      },
      contact: {
        email: this.contact.email.trim(),
        phone: this.contact.phone.trim()
      },
      status: 'CONFIRMED'
    };
  }
}
