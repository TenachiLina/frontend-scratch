import { useState, useEffect } from "react";


export default function TextField({
  id,
  name,
  label = "Label",
  value,
  defaultValue,
  onChange,
  type = "text",
  className = "",
  required = false,
  ...rest
}) {
  
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const [focused, setFocused] = useState(false);

  useEffect(() => {}, [value]);

  function handleChange(e) {
    if (!isControlled) setInternalValue(e.target.value);
    if (onChange) onChange(e);
  }

  const floated = focused || (currentValue && currentValue.toString().length > 0);

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "center",
          color: "black",
          fontSize: "20px",
          marginLeft:"35px",
          marginTop: "30px",
          marginBottom: "0px"
        }}
      >
      Today is : 
      </div>


      
      <div className={`tf-root ${className}`}>
        <div className={`tf-field ${floated ? "tf--floated" : ""}`}>
          <input
            id={id ?? name}
            name={name}
            type={type}
            value={isControlled ? value : undefined}
            defaultValue={!isControlled ? defaultValue : undefined}
            onChange={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label={label}
            required={required}
            className="tf-input"
            {...rest}
          />
          <label htmlFor={id ?? name} className="tf-label">
            {label}
          </label>
        </div>
      </div>
    </>
  );
}