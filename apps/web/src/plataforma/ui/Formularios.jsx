import { useId } from 'react';
import { Spinner } from './Estados.jsx';
import { Icon } from './Icon.jsx';

// Campo de formulario accesible: la etiqueta, el error y la ayuda quedan
// asociados al control (htmlFor, aria-describedby, aria-invalid).
//   <FormField label="Nombres" error={e} required>{props => <input {...props} />}</FormField>
export function FormField({ label, error, hint, required, full, children, id: idProp, className }) {
  const auto = useId();
  const id = idProp || auto;
  const child = typeof children === 'function'
    ? children({ id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': error || hint ? `${id}-d` : undefined, required })
    : children;
  return (
    <div className={`field${full ? ' full' : ''}${className ? ` ${className}` : ''}`}>
      <label htmlFor={id} className={required ? 'req' : undefined}>{label}</label>
      {child}
      {(error || hint) && <span id={`${id}-d`} className={error ? 'error' : 'hint'}>{error || hint}</span>}
    </div>
  );
}

export function BotonEnviar({ enviando, children, className = 'btn btn-primary', ...rest }) {
  return <button type="submit" className={className} disabled={enviando} aria-busy={enviando || undefined} {...rest}>{enviando && <Spinner small />}{children}</button>;
}

// Barra de búsqueda con etiqueta visible (accesible) e icono.
export function SearchBar({ label = 'Buscar', value, onChange, placeholder, maxLength = 80 }) {
  return (
    <FormField label={label} className="search-field">
      {p => (
        <div className="input-icon">
          <Icon name="buscar" />
          <input {...p} type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} />
        </div>
      )}
    </FormField>
  );
}

// Contenedor de filtros: búsqueda principal a la izquierda, filtros y resumen a la derecha.
export function FilterBar({ children, resumen, onSubmit, etiqueta = 'Filtros' }) {
  const Tag = onSubmit ? 'form' : 'div';
  return (
    <Tag className="filter-bar" role="search" aria-label={etiqueta} onSubmit={onSubmit ? e => { e.preventDefault(); onSubmit(); } : undefined}>
      <div className="filter-fields">{children}</div>
      {resumen && <div className="filter-summary">{resumen}</div>}
    </Tag>
  );
}

// Formulario en vista previa: los campos se muestran deshabilitados y el envío está
// bloqueado (no hay manejador que simule guardar). Se reemplaza por un formulario real
// con useEnvio() cuando la institución conecte su API.
export function FormularioVistaPrevia({ titulo = 'Formulario en vista previa', etiquetaEnvio = 'Guardar', children }) {
  const id = useId();
  return (
    <form className="preview-form" aria-describedby={`${id}-aviso`} onSubmit={e => e.preventDefault()} noValidate>
      <p id={`${id}-aviso`} className="sr-only">{titulo}: campos deshabilitados hasta conectar el backend.</p>
      <fieldset disabled className="fieldset-plain">
        <legend className="sr-only">{titulo}</legend>
        {children}
        <div className="form-actions">
          <span className="meta form-actions-note"><Icon name="enchufe" size={15} /> Se habilitará al conectar el backend</span>
          <button type="submit" className="btn btn-primary">{etiquetaEnvio}</button>
        </div>
      </fieldset>
    </form>
  );
}
