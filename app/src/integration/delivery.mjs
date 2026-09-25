// A timeout or retry-later response can follow an accepted update.
export const isConfirmedRejection = status => Number.isInteger(status) && status >= 400 && status < 500 && ![408, 425, 429].includes(status);
