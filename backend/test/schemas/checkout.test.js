import { describe, it, expect } from 'vitest';
import {
  CreateOrderItemSchema,
  CreateOrderSchema,
  VerifyPaymentSchema,
} from '../../schemas/checkout.js';

describe('CreateOrderItemSchema', () => {
  it('passes with valid data', () => {
    expect(() => CreateOrderItemSchema.parse({ productId: 'prod-1' })).not.toThrow();
  });

  it('passes with quantity of 1', () => {
    expect(() => CreateOrderItemSchema.parse({ productId: 'prod-1', quantity: 1 })).not.toThrow();
  });

  it('rejects quantity greater than 1 (items are one-of-a-kind)', () => {
    expect(() => CreateOrderItemSchema.parse({ productId: 'prod-1', quantity: 2 })).toThrow();
  });

  it('fails without productId', () => {
    expect(() => CreateOrderItemSchema.parse({})).toThrow();
  });

  it('fails with empty productId', () => {
    expect(() => CreateOrderItemSchema.parse({ productId: '' })).toThrow();
  });

  it('fails with negative quantity', () => {
    expect(() => CreateOrderItemSchema.parse({ productId: 'p1', quantity: -1 })).toThrow();
  });

  it('fails with non-integer quantity', () => {
    expect(() => CreateOrderItemSchema.parse({ productId: 'p1', quantity: 1.5 })).toThrow();
  });

  it('defaults quantity to 1', () => {
    const result = CreateOrderItemSchema.parse({ productId: 'p1' });
    expect(result.quantity).toBe(1);
  });
});

describe('CreateOrderSchema', () => {
  const valid = {
    shippingAddress: '123 Main St',
    city: 'Mumbai',
    state: 'Maharashtra',
    zipCode: '400001',
    phone: '9876543210',
    items: [{ productId: 'prod-1' }],
  };

  it('passes with valid data', () => {
    expect(() => CreateOrderSchema.parse(valid)).not.toThrow();
  });

  // Zod strips unknown keys, so an unlisted recipientName was silently dropped
  // on its way to Order.buyerName — the confirmation screen showed a name that
  // never reached the shipping label.
  it('keeps recipientName instead of stripping it', () => {
    const result = CreateOrderSchema.parse({ ...valid, recipientName: 'Priya Sharma' });
    expect(result.recipientName).toBe('Priya Sharma');
  });

  it('trims recipientName', () => {
    const result = CreateOrderSchema.parse({ ...valid, recipientName: '  Priya Sharma  ' });
    expect(result.recipientName).toBe('Priya Sharma');
  });

  it('rejects a blank recipientName rather than putting whitespace on the label', () => {
    expect(() => CreateOrderSchema.parse({ ...valid, recipientName: '   ' })).toThrow();
  });

  it('still accepts an order with no recipientName (older clients)', () => {
    const result = CreateOrderSchema.parse(valid);
    expect(result.recipientName).toBeUndefined();
  });

  it('fails without shippingAddress', () => {
    const { shippingAddress: _omit, ...rest } = valid;
    expect(() => CreateOrderSchema.parse(rest)).toThrow();
  });

  it('fails with empty shippingAddress', () => {
    expect(() => CreateOrderSchema.parse({ ...valid, shippingAddress: '' })).toThrow();
  });

  it('fails without city', () => {
    const { city: _omit, ...rest } = valid;
    expect(() => CreateOrderSchema.parse(rest)).toThrow();
  });

  it('fails without state', () => {
    const { state: _omit, ...rest } = valid;
    expect(() => CreateOrderSchema.parse(rest)).toThrow();
  });

  it('fails without zipCode', () => {
    const { zipCode: _omit, ...rest } = valid;
    expect(() => CreateOrderSchema.parse(rest)).toThrow();
  });

  it('fails with short phone', () => {
    expect(() => CreateOrderSchema.parse({ ...valid, phone: '12345' })).toThrow();
  });

  // `zipCode: z.string().min(1)` meant "4" was a valid Indian PIN code as far as
  // the server was concerned. An unroutable address is not discovered until the
  // parcel reaches a sorting hub days later.
  describe('zipCode', () => {
    const pin = (zipCode) => () => CreateOrderSchema.parse({ ...valid, zipCode });

    it('accepts a six-digit PIN code', () => {
      expect(CreateOrderSchema.parse({ ...valid, zipCode: '110001' }).zipCode).toBe('110001');
    });

    it('trims surrounding whitespace off a pasted PIN code', () => {
      expect(CreateOrderSchema.parse({ ...valid, zipCode: ' 400001 ' }).zipCode).toBe('400001');
    });

    it('rejects a single digit', () => {
      expect(pin('4')).toThrow();
    });

    it('rejects five digits', () => {
      expect(pin('40000')).toThrow();
    });

    it('rejects seven digits', () => {
      expect(pin('4000012')).toThrow();
    });

    it('rejects letters', () => {
      expect(pin('abcdef')).toThrow();
      expect(pin('40000A')).toThrow();
    });

    it('rejects a PIN with internal spacing', () => {
      expect(pin('400 001')).toThrow();
    });

    it('rejects an empty string', () => {
      expect(pin('')).toThrow();
    });

    it('fails without zipCode at all', () => {
      const { zipCode: _omit, ...rest } = valid;
      expect(() => CreateOrderSchema.parse(rest)).toThrow();
    });
  });

  // `phone: z.string().min(10)` accepted "abcdefghij". Indian mobile numbers are
  // ten digits beginning 6, 7, 8 or 9; 2-5 are landline trunk prefixes that no
  // courier SMS or delivery call can reach.
  describe('phone', () => {
    const phone = (value) => () => CreateOrderSchema.parse({ ...valid, phone: value });

    it.each(['6000000000', '7012345678', '8123456789', '9876543210'])('accepts %s', (value) => {
      expect(CreateOrderSchema.parse({ ...valid, phone: value }).phone).toBe(value);
    });

    it('trims surrounding whitespace', () => {
      expect(CreateOrderSchema.parse({ ...valid, phone: ' 9876543210 ' }).phone).toBe('9876543210');
    });

    it('rejects ten letters, which the old min(10) rule accepted', () => {
      expect(phone('abcdefghij')).toThrow();
    });

    it.each(['1234567890', '2876543210', '3876543210', '4876543210', '5876543210'])(
      'rejects %s, which is not a mobile prefix',
      (value) => {
        expect(phone(value)).toThrow();
      },
    );

    it('rejects nine digits', () => {
      expect(phone('987654321')).toThrow();
    });

    it('rejects eleven digits', () => {
      expect(phone('98765432101')).toThrow();
    });

    it('rejects a leading zero', () => {
      expect(phone('09876543210')).toThrow();
    });

    it('rejects a +91 country code, which the client strips before sending', () => {
      expect(phone('+919876543210')).toThrow();
      expect(phone('919876543210')).toThrow();
    });

    it('rejects spaced and hyphenated formatting', () => {
      expect(phone('98765 43210')).toThrow();
      expect(phone('98765-43210')).toThrow();
    });
  });

  it('fails with empty items array', () => {
    expect(() => CreateOrderSchema.parse({ ...valid, items: [] })).toThrow();
  });

  it('fails without items', () => {
    const { items: _omit, ...rest } = valid;
    expect(() => CreateOrderSchema.parse(rest)).toThrow();
  });

  // No payment gateway exists anymore — every order is cod or whatsapp.
  describe('paymentMethod', () => {
    it('defaults to whatsapp when omitted', () => {
      expect(CreateOrderSchema.parse(valid).paymentMethod).toBe('whatsapp');
    });

    it('accepts cod', () => {
      expect(CreateOrderSchema.parse({ ...valid, paymentMethod: 'cod' }).paymentMethod).toBe('cod');
    });

    it('accepts whatsapp', () => {
      expect(CreateOrderSchema.parse({ ...valid, paymentMethod: 'whatsapp' }).paymentMethod).toBe(
        'whatsapp',
      );
    });

    it('rejects online, which no longer has a gateway behind it', () => {
      expect(() => CreateOrderSchema.parse({ ...valid, paymentMethod: 'online' })).toThrow();
    });
  });
});

describe('VerifyPaymentSchema', () => {
  it('passes with required orderId only', () => {
    expect(() => VerifyPaymentSchema.parse({ orderId: 'order-1' })).not.toThrow();
  });

  it('fails without orderId', () => {
    expect(() => VerifyPaymentSchema.parse({})).toThrow();
  });

  it('fails with empty orderId', () => {
    expect(() => VerifyPaymentSchema.parse({ orderId: '' })).toThrow();
  });
});
