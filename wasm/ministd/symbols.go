package ministd

import "reflect"

// Symbols is the namespace map consumed by interp.Use.
var Symbols = map[string]map[string]reflect.Value{}
